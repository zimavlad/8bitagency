import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './log';

/**
 * Блокноти NotebookLM Влада: Джіпітенко, стратегиня й копірайтер радяться кожен зі своїм.
 * Відповідає справжній NotebookLM через MCP-сервер notebooklm-mcp: він крутить headless Chromium
 * у контейнері гри. Вхід у Google — cookies, які Влад імпортує через адмінку (state.json у профілі).
 * Безкоштовний акаунт дає 50 питань на день, Plus — у кілька разів більше, тож тримаємо денний ліміт і кеш; без входу, понад ліміт
 * або на збій — гра просто радиться з базою знань, як раніше.
 */
export type NotebookOwner = 'gpt' | 'strategist' | 'copywriter';

export interface Notebooks {
	ask(owner: NotebookOwner, question: string): Promise<string | null>;
}

const ENV: Record<NotebookOwner, string> = { gpt: 'NOTEBOOK_GPT', strategist: 'NOTEBOOK_STRATEGIST', copywriter: 'NOTEBOOK_COPYWRITER' };
const DAY_LIMIT = Number(process.env.NOTEBOOK_DAY_LIMIT ?? 200);
const TIMEOUT_MS = Number(process.env.NOTEBOOK_TIMEOUT_MS ?? 75000);

/** Посилання з адресного рядка (notebook.google.com чи notebooklm.google.com) → канонічне. */
export function notebookUrl(raw: string | undefined): string | null {
	const id = raw?.trim().match(/notebook\/([0-9a-f-]{20,})/i)?.[1];
	return id ? `https://notebooklm.google.com/notebook/${id}` : null;
}

/** Cookie-Editor експортує свій формат — переводимо в той, що читає Playwright (storageState). */
export function toStorageState(raw: unknown): { cookies: Record<string, unknown>[]; origins: [] } {
	const list = Array.isArray(raw) ? raw : Array.isArray((raw as { cookies?: unknown[] })?.cookies) ? (raw as { cookies: unknown[] }).cookies : [];
	const same = (s: unknown) => (s === 'strict' || s === 'Strict' ? 'Strict' : s === 'lax' || s === 'Lax' ? 'Lax' : 'None');
	const cookies = list
		.map((c) => c as Record<string, unknown>)
		.filter((c) => typeof c.name === 'string' && typeof c.value === 'string' && typeof c.domain === 'string' && String(c.domain).includes('google'))
		.map((c) => ({
			name: c.name,
			value: c.value,
			domain: c.domain,
			path: typeof c.path === 'string' ? c.path : '/',
			expires: typeof c.expirationDate === 'number' ? Math.floor(c.expirationDate) : typeof c.expires === 'number' ? c.expires : -1,
			httpOnly: !!c.httpOnly,
			secure: c.secure !== false,
			sameSite: same(c.sameSite)
		}));
	return { cookies, origins: [] };
}

/** Відповідь без службових приміток: позначка «AI-GENERATED», хвіст зі списком джерел. */
export function cleanAnswer(a: string): string {
	return a
		.replace(/^\[AI-GENERATED[^\]]*\]\s*/i, '')
		.replace(/\n+Sources:[\s\S]*$/i, '')
		.replace(/\[\d+(?:[,–-]\s*\d+)*\]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 1200);
}

export class NotebookLM implements Notebooks {
	private client: Client | null = null;
	private starting: Promise<Client> | null = null;
	private queue: Promise<unknown> = Promise.resolve();
	private cache = new Map<string, string>();
	private home: string;

	constructor(private dataDir: string) {
		this.home = join(dataDir, 'notebooklm');
		try {
			for (const [k, v] of Object.entries(JSON.parse(readFileSync(this.cacheFile(), 'utf8')) as Record<string, string>)) this.cache.set(k, v);
		} catch {
			// кешу ще нема
		}
	}

	/** Куди notebooklm-mcp кладе профіль Chromium і state.json (env-paths слухає XDG_DATA_HOME). */
	private get stateFile() {
		return join(this.home, 'data', 'notebooklm-mcp', 'browser_state', 'state.json');
	}
	private cacheFile() {
		return join(this.home, 'answers.json');
	}
	private usageFile() {
		return join(this.home, 'usage.json');
	}

	configured(owner: NotebookOwner) {
		return !!notebookUrl(process.env[ENV[owner]]);
	}

	authed() {
		return existsSync(this.stateFile);
	}

	/** Скільки питань уже поставили сьогодні (спільно на сервер). */
	usage(): { day: string; count: number } {
		const day = new Date().toISOString().slice(0, 10);
		try {
			const u = JSON.parse(readFileSync(this.usageFile(), 'utf8')) as { day: string; count: number };
			return u.day === day ? u : { day, count: 0 };
		} catch {
			return { day, count: 0 };
		}
	}

	private bump() {
		const u = this.usage();
		mkdirSync(this.home, { recursive: true });
		writeFileSync(this.usageFile(), JSON.stringify({ day: u.day, count: u.count + 1 }));
	}

	/** Імпорт cookies Google з Cookie-Editor: пишемо state.json і перезапускаємо браузер. */
	async importCookies(raw: unknown): Promise<{ ok: boolean; cookies: number; error?: string }> {
		const state = toStorageState(raw);
		const must = ['SID', '__Secure-1PSID'];
		if (!state.cookies.some((c) => must.includes(String(c.name)))) return { ok: false, cookies: state.cookies.length, error: 'Нема головних cookies Google (SID). Експортуй на сторінці notebooklm.google.com, коли ти залогінений.' };
		const dir = join(this.home, 'data', 'notebooklm-mcp', 'browser_state');
		mkdirSync(dir, { recursive: true });
		const tmp = `${this.stateFile}.tmp`;
		writeFileSync(tmp, JSON.stringify(state));
		renameSync(tmp, this.stateFile);
		await this.close();
		log('info', 'notebooklm_auth', { cookies: state.cookies.length });
		return { ok: true, cookies: state.cookies.length };
	}

	private async connect(): Promise<Client> {
		if (this.client) return this.client;
		if (this.starting) return this.starting;
		this.starting = (async () => {
			mkdirSync(join(this.home, 'data'), { recursive: true });
			const transport = new StdioClientTransport({
				command: process.execPath,
				args: [join(process.cwd(), 'node_modules', 'notebooklm-mcp', 'dist', 'index.js')],
				env: {
					...(process.env as Record<string, string>),
					XDG_DATA_HOME: join(this.home, 'data'),
					XDG_CONFIG_HOME: join(this.home, 'config'),
					HEADLESS: 'true',
					BROWSER_CHANNEL: 'chromium',
					NOTEBOOKLM_PROFILE: 'minimal',
					NOTEBOOKLM_AI_MARKER: 'false',
					ANSWER_TIMEOUT_MS: String(TIMEOUT_MS),
					MAX_SESSIONS: '2'
				},
				stderr: 'ignore'
			});
			const c = new Client({ name: '8bitagency', version: '1.0.0' });
			await c.connect(transport);
			transport.onclose = () => {
				this.client = null;
			};
			this.client = c;
			return c;
		})();
		try {
			return await this.starting;
		} finally {
			this.starting = null;
		}
	}

	async close() {
		const c = this.client;
		this.client = null;
		await c?.close().catch(() => undefined);
	}

	/** Стан для адмінки: чи є вхід, скільки питань сьогодні, що каже сам MCP. */
	async health(): Promise<Record<string, unknown>> {
		const out: Record<string, unknown> = { authed: this.authed(), usage: this.usage(), limit: DAY_LIMIT, notebooks: Object.fromEntries(Object.entries(ENV).map(([k, v]) => [k, !!notebookUrl(process.env[v])])) };
		try {
			const c = await this.connect();
			const r = (await c.callTool({ name: 'get_health', arguments: {} })) as { content?: { type: string; text?: string }[] };
			out.mcp = JSON.parse(r.content?.[0]?.text ?? '{}');
		} catch (e) {
			out.error = String(e).slice(0, 300);
		}
		return out;
	}

	/** Питання до блокнота. null — якщо блокнота нема, нема входу, ліміт вичерпано чи NotebookLM не відповів. */
	ask(owner: NotebookOwner, question: string): Promise<string | null> {
		const url = notebookUrl(process.env[ENV[owner]]);
		if (!url || !this.authed()) return Promise.resolve(null);
		const key = `${owner}:${question}`;
		const hit = this.cache.get(key);
		if (hit) return Promise.resolve(hit);
		if (this.usage().count >= DAY_LIMIT) {
			log('warn', 'notebooklm_limit', { owner });
			return Promise.resolve(null);
		}
		// Браузер один: питання йдуть по черзі.
		const job = this.queue.catch(() => undefined).then(async () => {
			const started = Date.now();
			try {
				const c = await this.connect();
				this.bump();
				const r = (await Promise.race([
					c.callTool({ name: 'ask_question', arguments: { question, notebook_url: url, source_format: 'none' } }, undefined, { timeout: TIMEOUT_MS + 5000 }),
					new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS + 10000))
				])) as { content?: { type: string; text?: string }[] };
				const j = JSON.parse(r.content?.[0]?.text ?? '{}') as { success?: boolean; data?: { answer?: string }; error?: string };
				if (!j.success || !j.data?.answer) {
					log('warn', 'notebooklm_failed', { owner, ms: Date.now() - started, error: String(j.error ?? 'empty').slice(0, 200) });
					return null;
				}
				const a = cleanAnswer(j.data.answer);
				this.cache.set(key, a);
				mkdirSync(this.home, { recursive: true });
				writeFileSync(this.cacheFile(), JSON.stringify(Object.fromEntries([...this.cache].slice(-300))));
				log('info', 'notebooklm_answer', { owner, ms: Date.now() - started, chars: a.length });
				return a;
			} catch (e) {
				log('warn', 'notebooklm_failed', { owner, ms: Date.now() - started, error: String(e).slice(0, 200) });
				await this.close();
				return null;
			}
		});
		this.queue = job;
		return job;
	}
}
