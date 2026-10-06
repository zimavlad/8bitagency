import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	COMMS_ROUNDS, CONTENT, DAY_START, STEP_HOURS, CORE, EDIT_SLOTS, ELEMENT_OWNER, ELEMENT_TITLE, MAX_CLIENT_ROUNDS, ROLE_NAME, ROLES,
	type Brief, type Burnout, type ClientVerdict, type ContentElement, type ElementId, type ElementValue, type LogoSpec,
	type Role, type RunPhase, type RunResult, type RunState, type Speaker, type Spot, type Staff, type StepKey
} from '$lib/types';
import { errFields, log } from '../log';
import { isAbortError, type CallPurpose, type ModelClient } from '../model/client';
import type { ImageModel } from '../model/images';
import { costUsd } from '../pricing';
import { rasterLogo } from '../raster';
import { GPT_CARD, PERSONA_CARD, clientCard, systemFor } from './characters';
import { qualityOf, reputationDelta } from './checks';
import { fake } from './fake';
import { pickMood } from '$lib/picks';
import { indexFor, search } from './kb';
import {
	GPT_HABIT, GPT_QUESTION, SCHEMA, StepError, briefBlock, guide, normClient, normContent, normGpt, normHuddle, normLogo,
	normIdea, normNaming, normPersona, normPositioning, normRead, normRename, normReposition, parseJson, prompt, readText, request,
	type Mix, type Msg, type Pos, type Read
} from './steps';

export interface Models {
	agent: string;
	review: string;
	client: string;
	gpt: string;
}

export interface RunDeps {
	model: ModelClient;
	images: ImageModel;
	models: Models;
	dataDir: string;
	burnout: Burnout;
	morale: Burnout;
	/** О котрій бриф почався (ігровий годинник). */
	clock?: number;
	/** Грейд і настрій кожного (junior/middle, образа після відмови в підвищенні). */
	staff?: Record<Role, Staff>;
	/** Мінімальна тривалість кроку, мс: щоб гравець встигав читати. У тестах 0. */
	paceMs?: number;
	onChange?: (run: Run) => void;
	onFinish?: (run: Run) => void;
	onSpend?: (provider: 'claude' | 'gemini', usd: number) => void;
}

/** Рішення гравця, на яке чекає бриф. */
export type Decision =
	| { action: 'pick'; index: number }
	| { action: 'submit' }
	| { action: 'edit'; notes: string[] }
	| { action: 'retry'; picks?: number[] }
	| { action: 'giveup' }
	| { action: 'continue' }
	| { action: 'more' }
	| { action: 'feedback'; notes: string[] };

/** Запис одного виклику моделі — для архіву прогону (бачити, що агенти думали насправді). */
export interface TraceEntry {
	t: string;
	purpose: CallPurpose | 'image';
	who: string;
	model: string;
	prompt: string;
	response: string;
	stop: string | null;
	ms: number;
	usd: number;
}

const NOTE_MAX = 280;

/** Для розкадровки — лише що в кадрі: без цитат, цифр, «акцій» і телефонів, щоб Gemini не малював плакат замість кадру. */
export function sceneOnly(x: string): string {
	return x
		.replace(/^[^,.:]{2,20}:\s*/u, '')
		.replace(/[«"“][^»"”]*[»"”]/g, 'a sign')
		.replace(/[+]?\d[\d\s()−-]{4,}\d/g, '')
		.replace(/[−-]?\d+\s?%/g, '')
		.replace(/(АКЦІЯ|акці[яїю]|знижк\S*|QR-?код|сайт|телефон\S*|номер\S*)/giu, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([,.;:])/g, '$1')
		.replace(/[,;:]+\./g, '.')
		.replace(/,\s*,/g, ',')
		.trim();
}
/** У своєму брифі гравець-клієнт може повернути роботу з правками до трьох разів на етап. */
const SELF_ROUNDS = 3;

/** Типові побажання клієнтів до платформи й реклами: з них щоразу випадково 3 підказки. */
const HINTS_CORE = [
	'логотип більший, щоб видно з маршрутки', 'золото або корона в логотипі', 'щоб було «як у Києві»', 'назва англійською для солідності',
	'фото власника десь поруч', 'кум радить червоний колір', '{spouse} каже — надто сумно', 'додати «з 1998 року»', 'щоб мама зрозуміла',
	'слово «найкращий»', 'як у конкурента, тільки краще', 'більше кольорів, щоб весело', 'герб міста', 'щоб пахло грошима', 'слоган у риму'
];
const HINTS_CONTENT = [
	'САЙТ великими', 'QR-код на пів банера', 'слово «АКЦІЯ»', 'номер телефону більший', '«-20%»', 'фото власника з котом', '«доставка безкоштовно»',
	'пʼять зірочок відгуків', '«ми в Instagram»', '«найкращі в місті»', 'адреса і схема проїзду', 'Viber, Telegram і WhatsApp іконки',
	'«працюємо без вихідних»', 'вибух-зірка «ХІТ»', 'мем з котом, щоб молодь', 'ще один логотип, про всяк випадок',
	'у ролику продукт крупно, щоб було видно', 'ціна в кожному кадрі ролика', 'диктор у фіналі кричить «тільки цього тижня»', 'весь асортимент на полиці у фіналі ролика'
];

function chance(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
	return ((h >>> 0) % 1000) / 1000;
}

function humanError(e: unknown): string {
	if (e instanceof StepError) return `Агент зламався: ${e.message}. Закрий бриф і спробуй інший.`;
	const status = (e as { status?: number })?.status;
	if (status === 401) return 'Claude не прийняв ключ API. Перевір ANTHROPIC_API_KEY на сервері.';
	if (status === 429) return 'Claude просить пригальмувати (ліміт запитів). Спробуй за хвилину.';
	if (status === 529 || (status && status >= 500)) return 'Claude перевантажений. Спробуй трохи згодом.';
	return 'Не вдалося дістатися до Claude. Перевір мережу сервера.';
}

const lastUser = (messages: Msg[]) => {
	const m = [...messages].reverse().find((x) => x.role === 'user');
	return typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
};

/**
 * Один бриф. Порядок і «хто що бачить»:
 * 1. Стратегиня читає бриф сама (Four Points), іноді питає Джіпітенка.
 * 2. Радиться: копірайтер і дизайнер бачать бриф і її розбір, відповідають «ок/сумнів» (модель ревʼю, окремі розмови).
 * 3. Стратегиня — позиціонування з трьох кандидатів.
 * 4. Копірайтер — 3 варіанти «назва + слоган», гравець обирає один.
 * 5. Дизайнер — знак під обрану назву.
 * 6. Гравець: показати клієнту або один раунд до 3 правок; переробка узгоджена (позиціонування → назва → знак).
 * 7. Клієнт: так / ще коло з його правками (вирішує гравець) / ні. До трьох кіл.
 * 8. Після «так» — канали коротко + картинки Gemini, знову гравець і клієнт, потім оплата.
 */
export class Run {
	readonly state: RunState;
	readonly trace: TraceEntry[] = [];
	private abort = new AbortController();
	private history: Record<Role, Msg[]> = { strategist: [], copywriter: [], designer: [] };
	private locks: Record<Role, Promise<unknown>> = { strategist: Promise.resolve(), copywriter: Promise.resolve(), designer: Promise.resolve() };
	private read: Read | null = null;
	private pos: Pos = { positioning: '', role: '', enemy: '' };
	private waiter: { phases: RunPhase[]; resolve: (d: Decision) => void } | null = null;
	private resume: (() => void) | null = null;
	private seq = 0;
	private coreAccepted = false;
	private contentAccepted = false;
	readonly burnoutDelta: Burnout = { strategist: 0, copywriter: 0, designer: 0 };
	readonly moraleDelta: Burnout = { strategist: 0, copywriter: 0, designer: 0 };

	constructor(readonly id: string, brief: Brief, private deps: RunDeps) {
		this.state = {
			id,
			brief,
			phase: 'read',
			status: 'Команда відкриває бриф',
			paused: false,
			agents: {
				strategist: { status: 'idle', spot: 'desk', burnout: deps.burnout.strategist, morale: deps.morale.strategist, hp: 100, doing: 'на місці' },
				copywriter: { status: 'idle', spot: 'desk', burnout: deps.burnout.copywriter, morale: deps.morale.copywriter, hp: 100, doing: 'на місці' },
				designer: { status: 'idle', spot: 'desk', burnout: deps.burnout.designer, morale: deps.morale.designer, hp: 100, doing: 'на місці' }
			},
			clientInOffice: false,
			elements: {},
			strategy: null,
			steps: [],
			task: null,
			rerolls: 0,
			changed: [],
			clock: deps.clock ?? DAY_START,
			options: [],
			editAvailable: false,
			clientRound: 0,
			speech: [],
			log: [],
			verdicts: [],
			result: null,
			error: null,
			demo: deps.model.demo,
			calls: 0,
			costUsd: 0,
			imagesUsd: 0
		};
	}

	/* ─────────── події ─────────── */

	private emit() {
		this.deps.onChange?.(this);
	}

	private say(who: Speaker, text: string, kind: 'thought' | 'gpt' | 'client' | 'system' = 'thought', to?: Role, more?: string[]) {
		if (!text) return;
		const seq = ++this.seq;
		this.state.speech = [...this.state.speech.slice(-29), { seq, who, text, kind, to }];
		this.state.log = [...this.state.log.slice(-299), { seq, who, text, ...(more?.length ? { more } : {}) }];
		this.emit();
	}

	private note(text: string, more?: string[]) {
		this.state.log = [...this.state.log.slice(-299), { seq: ++this.seq, who: 'system', text, ...(more?.length ? { more } : {}) }];
		this.emit();
	}

	private phase(p: RunPhase, status: string, spots?: Partial<Record<Role, Spot>>) {
		this.state.phase = p;
		this.state.status = status;
		if (spots) for (const r of ROLES) if (spots[r]) this.state.agents[r].spot = spots[r]!;
		log('info', 'run_phase', { run: this.id, phase: p });
		this.emit();
	}

	private agent(r: Role, status: RunState['agents'][Role]['status'], doing?: string) {
		this.state.agents[r].status = status;
		if (doing) this.state.agents[r].doing = doing;
		this.emit();
	}

	private tire(r: Role, n: number) {
		this.burnoutDelta[r] += n;
		this.state.agents[r].burnout = this.burnoutOf(r);
	}

	private burnoutOf(r: Role) {
		return Math.max(0, Math.min(100, this.deps.burnout[r] + this.burnoutDelta[r]));
	}

	private moraleOf(r: Role) {
		return Math.max(0, Math.min(100, this.deps.morale[r] + this.moraleDelta[r]));
	}

	/** Мораль: мінус — клієнт незадоволений, плюс — перемоги, похвала, піца. */
	private cheer(n: number, roles: Role[] = ROLES) {
		for (const r of roles) {
			this.moraleDelta[r] += n;
			this.state.agents[r].morale = this.moraleOf(r);
		}
	}

	/** Зміни від керівника під час брифу (кава, піца, похвала): дельти стресу й моралі. */
	adjust(stress: Partial<Record<Role, number>>, morale: Partial<Record<Role, number>>) {
		for (const r of ROLES) {
			this.burnoutDelta[r] += stress[r] ?? 0;
			this.moraleDelta[r] += morale[r] ?? 0;
			this.state.agents[r].burnout = this.burnoutOf(r);
			this.state.agents[r].morale = this.moraleOf(r);
		}
		this.emit();
	}

	/** Випадкові «доїбки» під цей бриф і коло — щоб клієнт не просив щоразу знижку й акцію. */
	private hints(stage: 'core' | 'content', round: number): string[] {
		const pool = stage === 'core' ? HINTS_CORE : HINTS_CONTENT;
		const out: string[] = [];
		for (let i = 0; out.length < 3 && i < 20; i++) {
			const h = pool[Math.floor(chance(`${this.id}:${stage}:${round}:${i}`) * pool.length)];
			const g = h.replace('{spouse}', this.state.brief.client.gender === 'f' ? 'чоловік' : 'дружина');
			if (!out.includes(g)) out.push(g);
		}
		return out;
	}

	/** Скільки правок і яких: від 1 до 7, більшість — «повітря» й тупі питання, решта — «серйозні» зі страху. */
	private mix(stage: 'core' | 'content', round: number): Mix {
		const n = 1 + Math.floor(chance(`${this.id}:mix:${stage}:${round}`) * 7);
		let serious = Math.round((n * 3) / 7);
		const dumb = n - serious >= 2 ? 1 : n === 1 && chance(`${this.id}:dumb:${stage}:${round}`) > 0.5 ? 1 : 0;
		// з рекламним бюджетом клієнт обовʼязково хоче телевізор
		if (stage === 'content' && this.state.brief.budget && !serious) serious = 1;
		return { empty: Math.max(0, n - serious - dumb), dumb, serious };
	}

	private sys(r: Role) {
		return systemFor(r, this.burnoutOf(r), this.moraleOf(r), this.deps.staff?.[r]);
	}

	/** Прогрес роботи між рішеннями гравця: скільки кроків і який зараз. */
	private work(stage: 'platform' | 'comms', total: number) {
		this.state.task = { stage, label: '', done: 0, total, at: Date.now(), pace: this.deps.paceMs ?? 0 };
	}
	private step(label: string) {
		// кожен крок — це ігровий час: повний бриф з усіма колами переходить через ніч у ранок
		this.state.clock += STEP_HOURS;
		if (this.state.task) this.state.task = { ...this.state.task, label, at: Date.now() };
		this.emit();
	}
	private tick() {
		if (this.state.task) this.state.task = { ...this.state.task, done: Math.min(this.state.task.total, this.state.task.done + 1), at: Date.now() };
		this.emit();
	}
	private idle() {
		this.state.task = null;
	}

	/** Запис етапу: що сталося, щоб гравець міг повернутись і переглянути. */
	private record(key: StepKey, lines: string[], logo?: LogoSpec) {
		const steps = [...this.state.steps];
		const i = steps.findIndex((x) => x.key === key);
		const cur = i >= 0 ? steps[i] : { key, lines: [] };
		const next = { ...cur, lines: [...cur.lines, ...lines.filter(Boolean)], ...(logo ? { logos: [...(cur.logos ?? []), logo] } : {}) };
		if (i >= 0) steps[i] = next;
		else steps.push(next);
		this.state.steps = steps;
	}

	private alive() {
		if (this.abort.signal.aborted) {
			const e = new Error('aborted');
			e.name = 'AbortError';
			throw e;
		}
	}

	/** Між кроками: якщо гравець поставив паузу — чекаємо. */
	private async gate() {
		this.alive();
		if (this.state.paused) await new Promise<void>((r) => (this.resume = r));
		this.alive();
	}

	setPaused(on: boolean) {
		if (this.state.phase === 'done' || this.state.phase === 'failed') return;
		this.state.paused = on;
		if (!on && this.resume) {
			const r = this.resume;
			this.resume = null;
			r();
		}
		this.emit();
	}

	/* ─────────── виклики ─────────── */

	private async call(o: { purpose: CallPurpose; who: string; model: string; system: string; messages: Msg[]; schema: Record<string, unknown>; fake: () => unknown }) {
		this.alive();
		const started = Date.now();
		const r = await this.deps.model.call(request({ model: o.model, system: o.system, messages: o.messages, schema: o.schema }), {
			purpose: o.purpose,
			who: `${this.id}:${o.who}`,
			signal: this.abort.signal,
			fake: o.fake
		});
		this.alive();
		const left = (this.deps.paceMs ?? 0) - (Date.now() - started);
		if (left > 0) {
			await new Promise((res) => setTimeout(res, left));
			this.alive();
		}
		const usd = costUsd(r.model, r.usage);
		this.state.calls++;
		this.state.costUsd += usd;
		this.deps.onSpend?.('claude', usd);
		this.trace.push({ t: new Date().toISOString(), purpose: o.purpose, who: o.who, model: r.model, prompt: lastUser(o.messages), response: r.text, stop: r.stopReason, ms: Date.now() - started, usd });
		if (r.stopReason === 'refusal') throw new StepError('Claude відмовився відповідати на цей бриф');
		if (r.stopReason === 'max_tokens') throw new StepError('відповідь обірвалась на півслові');
		return r;
	}

	/** Хід у власній розмові агента: історія лише дописується, ходи одного агента — по черзі. */
	private ask(role: Role, purpose: CallPurpose, user: string, schema: Record<string, unknown>, fakeFn: () => unknown): Promise<Record<string, unknown>> {
		const job = this.locks[role].catch(() => undefined).then(async () => {
			const messages: Msg[] = [...this.history[role], { role: 'user', content: user + guide(schema) }];
			const r = await this.call({ purpose, who: role, model: this.deps.models.agent, system: this.sys(role), messages, schema, fake: fakeFn });
			this.history[role] = [...messages, { role: 'assistant', content: r.content }];
			this.tire(role, 3);
			return parseJson(r.text);
		});
		this.locks[role] = job;
		return job;
	}

	/** Окремий виклик без історії агента (порада колезі, клієнт, персона). */
	private async once(o: { purpose: CallPurpose; who: string; model: string; system: string; user: string; schema: Record<string, unknown>; fake: () => unknown }) {
		const r = await this.call({ ...o, messages: [{ role: 'user', content: o.user + guide(o.schema) }] });
		return parseJson(r.text);
	}

	private async maybeGpt(role: Role, step: 'read' | 'naming'): Promise<string | undefined> {
		if (chance(`${this.id}:${role}:${step}`) >= GPT_HABIT[role]) return undefined;
		const question = step === 'read' ? GPT_QUESTION.read(role, this.state.brief) : GPT_QUESTION.naming(this.state.brief);
		this.agent(role, 'gpt', 'радиться з Джіпітенком');
		this.say(role, `Джіпітенко, ${question}`, 'system');
		const index = await indexFor(this.deps.dataDir, role);
		const chunks = search(index, `${this.state.brief.client.business} ${this.state.brief.text} ${question}`, 3);
		const g = normGpt(await this.once({
			purpose: 'gpt', who: `gpt:${role}`, model: this.deps.models.gpt, system: GPT_CARD,
			user: prompt.gpt(role, question, chunks), schema: SCHEMA.gpt, fake: () => fake.gpt(chunks[0]?.source ?? '')
		}));
		this.say('gpt', g.source && g.source !== 'загальні знання' ? `${g.answer} (з бази: ${g.source})` : g.answer, 'gpt', role);
		this.agent(role, 'thinking');
		return g.answer;
	}

	/* ─────────── гравець ─────────── */

	private wait(phases: RunPhase[]): Promise<Decision> {
		return new Promise((resolve) => (this.waiter = { phases, resolve }));
	}

	/** Рішення гравця. Повертає текст помилки або null. */
	decide(d: Decision): string | null {
		const w = this.waiter;
		if (!w || !w.phases.includes(this.state.phase)) return 'Зараз команда не чекає твого рішення.';
		const p = this.state.phase;
		if (d.action === 'feedback' || (d.action === 'continue' && (p === 'client_core' || p === 'client_content'))) {
			if (!this.state.brief.custom || (p !== 'client_core' && p !== 'client_content')) return 'Зараз не твоя черга як клієнта.';
			if (d.action === 'feedback') {
				if (this.state.clientRound > SELF_ROUNDS) return 'Три кола правок минуло — тепер тільки «беру».';
				const notes = d.notes.map((n) => String(n ?? '').trim()).filter(Boolean);
				if (!notes.length) return 'Напиши хоча б одну правку.';
				if (notes.length > EDIT_SLOTS || notes.some((n) => n.length > NOTE_MAX)) return `До ${EDIT_SLOTS} правок по ${NOTE_MAX} знаків.`;
				d = { action: 'feedback', notes };
			}
		} else if (d.action === 'more') {
			if (p !== 'pick_name') return 'Зараз не обирають назву.';
			if (!this.state.rerolls) return 'Копірайтер більше не може: обери з того, що є.';
		} else if (d.action === 'pick') {
			if (p !== 'pick_name') return 'Зараз не обирають назву.';
			if (!Number.isInteger(d.index) || d.index < 0 || d.index >= this.state.options.length) return 'Нема такого варіанта.';
		} else if (d.action === 'submit') {
			if (p !== 'player_core' && p !== 'player_content') return 'Зараз нема чого показувати клієнту.';
		} else if (d.action === 'edit') {
			if (p !== 'player_core' && p !== 'player_content') return 'Зараз правки не приймаються.';
			if (!this.state.editAvailable) return 'Раунд правок на цьому етапі вже використано.';
			const notes = d.notes.map((n) => String(n ?? '').trim()).filter(Boolean);
			if (!notes.length) return 'Напиши хоча б одну правку.';
			if (notes.length > EDIT_SLOTS) return `Не більше ${EDIT_SLOTS} правок.`;
			if (notes.some((n) => n.length > NOTE_MAX)) return `Кожна правка — до ${NOTE_MAX} знаків.`;
			d = { action: 'edit', notes };
		} else if (d.action === 'retry' || d.action === 'giveup' || d.action === 'continue') {
			if (p !== 'client_decision_core' && p !== 'client_decision_content') return 'Зараз клієнт не чекає відповіді.';
			const v = this.state.verdicts.at(-1)?.verdict;
			if (d.action === 'continue' && v === 'rework') return 'Клієнт чекає: ще коло чи кидаємо проєкт?';
			if (d.action !== 'continue' && v !== 'rework') return 'Тут лише «далі».';
			if (d.action === 'retry' && d.picks) {
				const n = this.state.verdicts.at(-1)?.demands.length ?? 0;
				const picks = [...new Set(d.picks)].filter((i) => i >= 0 && i < n);
				if (!picks.length) return 'Відміть хоча б одну правку.';
				d = { action: 'retry', picks };
			}
		}
		this.waiter = null;
		w.resolve(d);
		return null;
	}

	/* ─────────── сценарій ─────────── */

	start() {
		this.play().catch((e) => {
			if (isAbortError(e)) return;
			this.state.error = humanError(e);
			log('error', 'run_failed', { run: this.id, phase: this.state.phase, ...errFields(e) });
			this.phase('failed', 'Бриф зупинився через помилку');
			for (const r of ROLES) this.state.agents[r].status = 'idle';
			this.note(this.state.error);
			this.deps.onFinish?.(this);
		});
	}

	private async play() {
		const b = this.state.brief;
		// Свій бриф: клієнт — сам гравець, кумедний лисий тіп; правки пише сам.
		if (b.custom) {
			this.state.brief = { ...b, client: { ...b.client, name: 'Ти', role: 'замовник', gender: 'm', look: 'leather', archetype: 'ти сам собі замовник: лисий, вимогливий і з грошима', voice: '' } };
			this.emit();
		}
		this.note(`Бриф від ${b.client.name}, ${b.client.business}. Гонорар ${b.fee.toLocaleString('uk-UA')} ₴.`);

		// 1. стратегиня читає сама
		this.work('platform', 4);
		this.step('Стратегиня шукає, чого насправді боїться клієнт');
		this.phase('read', 'Стратегиня читає бриф', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		this.agent('copywriter', 'idle', 'чекає на стратегиню');
		this.agent('designer', 'idle', 'чекає на стратегиню');
		await this.gate();
		this.agent('strategist', 'thinking', 'читає бриф');
		const gpt = await this.maybeGpt('strategist', 'read');
		this.read = normRead(await this.ask('strategist', 'read', prompt.read(b, gpt), SCHEMA.read, () => fake.read(b, !!gpt)));
		this.say('strategist', this.read.thought, 'thought', undefined, readText(this.read).split('\n'));
		this.state.strategy = { problem: this.read.problem, insight: this.read.insight, advantage: this.read.advantage, direction: this.read.direction };
		this.record('strategy', readText(this.read).split('\n'));
		if (this.read.gptTake) this.note(`Стратегиня про Джіпітенка: ${this.read.gptTake}`);
		this.tick();

		// 2. радиться з колегами
		await this.gate();
		this.step('Нарада біля столу. Хтось уже доїдає піцу');
		this.phase('huddle', 'Стратегиня радиться з колегами', { strategist: 'table', copywriter: 'table', designer: 'table' });
		this.agent('strategist', 'idle', 'розповідає напрям');
		this.say('strategist', this.read.direction, 'thought');
		const notes = await Promise.all((['copywriter', 'designer'] as const).map(async (r) => {
			await this.gate();
			this.agent(r, 'thinking', 'слухає стратегиню');
			const h = normHuddle(await this.once({
				purpose: 'review', who: r, model: this.deps.models.review, system: this.sys(r),
				user: prompt.huddle(r, b, this.read!), schema: SCHEMA.huddle, fake: () => fake.huddle(r)
			}));
			this.tire(r, 2);
			this.say(r, h.thought, 'thought', undefined, [`${h.ok ? 'Ок' : 'Сумнів'}: ${h.note}`]);
			this.agent(r, 'done', h.ok ? 'погодився' : 'має сумнів');
			return { role: r as Role, text: `${h.ok ? 'ок' : 'сумнів'} — ${h.note}` };
		}));
		this.record('strategy', notes.map((n) => `${ROLE_NAME[n.role]}: ${n.text}`));
		this.tick();

		// 3. позиціонування
		await this.gate();
		this.step('Стратегиня втискає суть в одне речення');
		this.phase('position', 'Стратегиня формулює позиціонування', { strategist: 'board', copywriter: 'desk', designer: 'desk' });
		this.agent('strategist', 'thinking', 'пише позиціонування');
		const p = normPositioning(await this.ask('strategist', 'core', prompt.positioning(notes), SCHEMA.positioning, () => fake.positioning(b)));
		this.pos = { positioning: p.positioning, role: p.role, enemy: p.enemy };
		this.setEl('positioning', p.positioning, [`Роль: ${p.role}`, `Ворог: ${p.enemy}`], { rejected: p.rejected, why: p.why });
		this.record('strategy', [`Позиціонування: ${p.positioning}`, ...p.rejected.map((r) => `Відкинула: ${r.text} — ${r.reason}`)]);
		this.say('strategist', p.thought, 'thought', undefined, [p.positioning, ...p.rejected.map((r) => `відкинула: ${r.text} — ${r.reason}`)]);
		this.agent('strategist', 'done', 'позиціонування готове');
		this.tick();

		// 4. креативна ідея: навіть під серйозну стратегію — сміливий сучасний прикол
		await this.gate();
		this.step('Копірайтер вигадує, про що напишуть у Threads');
		this.phase('naming', 'Копірайтер шукає креативну ідею', { strategist: 'coffee' });
		this.agent('copywriter', 'thinking', 'вигадує ідею');
		const idea = normIdea(await this.ask('copywriter', 'core', prompt.idea(this.pos, this.read, b.budget), SCHEMA.idea, () => fake.idea()));
		this.setEl('idea', idea.idea, idea.how, { why: idea.why });
		this.record('name', [`Ідея: ${idea.idea}`, ...idea.how.map((h) => `Як живе: ${h}`)]);
		this.say('copywriter', idea.thought, 'thought', undefined, [idea.idea, ...idea.how]);
		this.tick();

		// 5. назва: 3 варіанти, обирає гравець
		await this.gate();
		this.step('Копірайтер викреслює двадцяту назву');
		this.phase('naming', 'Копірайтер шукає назву', { strategist: 'coffee' });
		this.agent('copywriter', 'thinking', 'шукає назву');
		const g2 = await this.maybeGpt('copywriter', 'naming');
		const nm = normNaming(await this.ask('copywriter', 'core', prompt.naming(this.pos, g2, idea.idea), SCHEMA.naming, () => fake.naming(!!g2)));
		this.state.options = nm.options;
		this.say('copywriter', nm.thought, 'thought', undefined, nm.options.map((o) => `${o.name} — «${o.slogan}» (${o.why})`));
		if (nm.gptTake) this.note(`Копірайтер про Джіпітенка: ${nm.gptTake}`);
		this.agent('copywriter', 'idle', 'чекає твого вибору');
		this.tick();
		this.idle();
		// Не подобається жоден — «ще варіанти» (двічі на бриф): копірайтер думає заново, всі відкинуті йдуть в історію.
		const tried: string[] = [];
		this.state.rerolls = 2;
		let pick: { action: 'pick'; index: number };
		for (;;) {
			this.phase('pick_name', 'Твій хід: обери назву', { copywriter: 'table', strategist: 'table' });
			const d = await this.wait(['pick_name']);
			if (d.action === 'pick') { pick = d; break; }
			this.state.rerolls--;
			tried.push(...this.state.options.map((o) => `${o.name} — «${o.slogan}»`));
			this.record('name', this.state.options.map((o) => `Забраковано: ${o.name} — «${o.slogan}»`));
			this.work('platform', 1);
			this.step('Копірайтер зітхає і думає заново');
			this.phase('naming', 'Копірайтер шукає нові назви', { copywriter: 'desk' });
			this.agent('copywriter', 'thinking', 'шукає нові назви');
			const again = normNaming(await this.ask('copywriter', 'core', prompt.renaming(tried), SCHEMA.naming, () => fake.naming(false)));
			this.state.options = again.options;
			this.say('copywriter', again.thought, 'thought', undefined, again.options.map((o) => `${o.name} — «${o.slogan}» (${o.why})`));
			this.agent('copywriter', 'idle', 'чекає твого вибору');
			this.tick();
			this.idle();
		}
		this.state.rerolls = 0;
		const chosen = this.state.options[pick.index];
		this.setEl('name', chosen.name, [], { why: chosen.why, rejected: this.state.options.filter((_, i) => i !== pick.index).map((o) => ({ text: o.name, reason: o.slogan })) });
		this.setEl('slogan', chosen.slogan, [], { why: chosen.why });
		this.record('name', this.state.options.map((o, i) => `${i === pick.index ? 'Обрано' : 'Варіант'}: ${o.name} — «${o.slogan}» (${o.why})`));
		this.note(`Ти обрав: ${chosen.name} — «${chosen.slogan}»`);
		this.history.copywriter.push({ role: 'user', content: `Керівник обрав варіант: ${chosen.name} — «${chosen.slogan}».` }, { role: 'assistant', content: '{"ok":true}' });

		// 5. знак
		await this.gate();
		this.work('platform', 1);
		this.step('Дизайнер мовчки малює знак');
		this.phase('logo', 'Дизайнер малює знак', { designer: 'desk', copywriter: 'desk' });
		this.agent('designer', 'thinking', 'малює знак');
		const lg = await this.drawLogo('core', prompt.logo(this.pos, chosen.name, chosen.slogan, this.state.elements.idea?.text));
		this.setEl('logo', lg.concept, [], { logo: lg.logo, why: lg.thought });
		this.record('logo', [lg.concept], lg.logo);
		this.say('designer', lg.thought, 'thought', undefined, [lg.concept]);
		this.agent('designer', 'done', 'знак готовий');
		this.tick();

		// 6–7. гравець і клієнт по основі
		this.coreAccepted = await this.stage('core');
		if (!this.coreAccepted) return this.finish('reject');

		// 8. канали
		await this.gate();
		this.phase('content', 'Команда робить рекламу під затверджену платформу', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		this.work('comms', CONTENT.length + 1);
		this.step('Пишуть пости, рілси й сценарій ролика');
		await Promise.all(CONTENT.map((id) => this.contentStep(id).then(() => this.tick())));
		this.step('Дизайнер малює банер і обкладинку');
		await this.images();
		this.tick();
		this.contentAccepted = await this.stage('content');
		this.finish(this.contentAccepted ? 'ok' : 'reject');
	}

	/** Знак з однією повторною спробою: порожній або невидимий знак дизайнер перемальовує. */
	private async drawLogo(purpose: 'core' | 'rework', text: string) {
		try {
			return normLogo(await this.ask('designer', purpose, text, SCHEMA.logo, () => fake.logo()));
		} catch (e) {
			if (!(e instanceof StepError)) throw e;
			log('warn', 'logo_retry', { run: this.id });
			return normLogo(await this.ask('designer', purpose, 'Знак вийшов порожнім: фігури без розміру або злились із тлом. Перемалюй: від 2 до 6 видимих фігур, радіуси й розміри не менше 6, кольори a і b контрастні до bg.', SCHEMA.logo, () => fake.logo()));
		}
	}

	private async persona() {
		const r = normPersona(await this.once({ purpose: 'client', who: 'persona', model: this.deps.models.gpt, system: PERSONA_CARD, user: prompt.persona(this.state.brief.text), schema: SCHEMA.persona, fake: () => fake.persona() }));
		this.state.brief = { ...this.state.brief, client: { ...this.state.brief.client, name: r.name, gender: r.gender, look: r.look, archetype: r.archetype || this.state.brief.client.archetype, voice: r.voice } };
		this.emit();
	}

	private setEl(id: ElementId, text: string, details: string[], extra: Partial<ElementValue> = {}) {
		const prev = this.state.elements[id];
		this.state.elements = {
			...this.state.elements,
			[id]: { id, text, details, reworks: prev?.reworks ?? 0, ...(prev?.rejected ? { rejected: prev.rejected } : {}), ...(prev?.logo ? { logo: prev.logo } : {}), ...(prev?.image ? { image: prev.image } : {}), ...(prev?.why ? { why: prev.why } : {}), ...extra }
		};
		this.emit();
	}

	private bump(id: ElementId) {
		const e = this.state.elements[id];
		if (e) this.setEl(id, e.text, e.details, { reworks: e.reworks + 1 });
		if (!this.state.changed.includes(id)) this.state.changed = [...this.state.changed, id];
	}

	/**
	 * Етап «гравець → клієнт». Платформа: два кола правок клієнта, на третьому він у захваті.
	 * Комунікація: одне коло «а додайте QR і АКЦІЮ», на другому — «беру». Гравець може кинути проєкт.
	 */
	private async stage(stage: 'core' | 'content'): Promise<boolean> {
		const ids: ElementId[] = stage === 'core' ? CORE : CONTENT;
		const playerPhase: RunPhase = stage === 'core' ? 'player_core' : 'player_content';
		const decisionPhase: RunPhase = stage === 'core' ? 'client_decision_core' : 'client_decision_content';
		const you: StepKey = stage === 'core' ? 'you_core' : 'you_content';
		const them: StepKey = stage === 'core' ? 'client_core' : 'client_content';
		// Взяв замало правок або без кринжової — клієнт ображається і додає коло (раз на етап).
		let rounds = stage === 'core' ? MAX_CLIENT_ROUNDS : COMMS_ROUNDS;
		let extended = false;
		const name = this.state.brief.client.name;

		this.state.editAvailable = true;
		for (;;) {
			this.idle();
			this.phase(playerPhase, this.state.editAvailable ? 'Твій хід: зведення чекає' : 'Правки внесли. Несемо клієнту?', { strategist: 'table', copywriter: 'table', designer: 'table' });
			for (const r of ROLES) this.agent(r, 'idle', 'чекає твого рішення');
			const d = await this.wait([playerPhase]);
			if (d.action !== 'edit') break;
			this.state.editAvailable = false;
			this.record(you, d.notes.map((n) => `Твоя правка: ${n}`));
			this.note('Твої правки', d.notes);
			await this.rework(stage, 'керівник агенції', d.notes);
		}
		this.state.editAvailable = false;
		this.record(you, ['Показав клієнту']);

		this.state.clientInOffice = true;
		for (let round = 1; round <= (this.state.brief.custom ? SELF_ROUNDS + 1 : rounds); round++) {
			this.state.clientRound = round;
			if (this.state.brief.custom) {
				// Гравець сам дивиться роботу й вирішує: «беру» або правки текстом (лисий проговорює їх у баблі).
				this.idle();
				const cp: RunPhase = stage === 'core' ? 'client_core' : 'client_content';
				this.phase(cp, round > SELF_ROUNDS ? 'Ти — клієнт: правок більше не буде, лише «беру»' : 'Ти — клієнт: бери або повертай з правками', { strategist: 'table', copywriter: 'table', designer: 'table' });
				for (const r of ROLES) this.agent(r, 'idle', 'нервово чекає');
				const d = await this.wait([cp]);
				if (d.action !== 'feedback') {
					const v: ClientVerdict = { stage, round, reaction: 'Беру.', lines: ['Беру. Не ідеально, але беру.'], demands: [], verdict: 'ok', mood: 90 };
					this.state.verdicts = [...this.state.verdicts, v];
					this.say('client', v.lines[0], 'client');
					this.record(them, [`Коло ${round}: беру`]);
					this.cheer(stage === 'core' ? 6 : 8);
					this.state.clientInOffice = false;
					return true;
				}
				const v: ClientVerdict = { stage, round, reaction: '', lines: d.notes, demands: d.notes, verdict: 'rework', mood: 50 };
				this.state.verdicts = [...this.state.verdicts, v];
				for (const n of d.notes) this.say('client', n, 'client');
				this.record(them, d.notes.map((n) => `Коло ${round}, твоя правка: ${n}`));
				this.cheer(-3);
				// кинув правки — і пішов: команда переробляє без нього
				this.state.clientInOffice = false;
				await this.rework(stage, 'клієнт', d.notes);
				for (const r of ROLES) this.tire(r, 3);
				this.idle();
				this.phase(playerPhase, 'Переробили під твої правки. Глянь і неси собі ж', { strategist: 'table', copywriter: 'table', designer: 'table' });
				await this.wait([playerPhase]);
				this.state.clientInOffice = true;
				continue;
			}
			this.work(stage === 'core' ? 'platform' : 'comms', 1);
			this.step(round > 1 ? `${name} шукає, що б ще поміняти` : `${name} гортає презентацію з телефона`);
			this.phase(stage === 'core' ? 'client_core' : 'client_content', `${name} дивиться роботу${round > 1 ? ` (коло ${round})` : ''}`, { strategist: 'table', copywriter: 'table', designer: 'table' });
			for (const r of ROLES) this.agent(r, 'idle', 'нервово чекає');
			await this.gate();
			const items = ids.map((id) => this.state.elements[id]).filter((e): e is ElementValue => !!e);
			const c = normClient(await this.once({
				purpose: 'client', who: 'client', model: this.deps.models.client, system: clientCard(this.state.brief.client, this.state.brief.text),
				user: prompt.client(items, stage, round, stage === 'content' ? `Бренд-платформу (${this.state.elements.name?.text}, «${this.state.elements.slogan?.text}») ти вже затвердив.` : undefined, this.state.verdicts.flatMap((v) => v.demands), round < rounds ? this.hints(stage, round) : [], this.state.brief.client.gender, round < rounds ? this.mix(stage, round) : undefined, this.state.brief.budget, round >= rounds),
				schema: SCHEMA.client, fake: () => fake.client(round, stage)
			}), stage, round, rounds);
			this.tick();
			this.idle();
			const v: ClientVerdict = { stage, round, ...c };
			for (const line of c.lines) this.say('client', line, 'client');
			this.state.verdicts = [...this.state.verdicts, v];
			this.record(them, [`Коло ${round}: ${c.lines.join(' / ')}`, `Підсумок: ${c.reaction}`, ...c.demands.map((x) => `Вимога: ${x}`)]);
			if (c.verdict === 'ok') this.cheer(stage === 'core' ? 6 : 8);
			else this.cheer(-5);

			const word = c.verdict === 'ok' ? `${name} у захваті` : `${name} хоче правок`;
			this.note(word, [c.reaction, ...c.demands]);
			this.phase(decisionPhase, c.verdict === 'rework' ? `${word}. Ще коло чи кидаємо проєкт?` : word);
			for (const r of ROLES) this.agent(r, 'idle', c.verdict === 'ok' ? 'видихає' : 'зітхає');
			const d = await this.wait([decisionPhase]);
			if (c.verdict === 'ok') {
				this.state.clientInOffice = false;
				return true;
			}
			if (d.action === 'giveup') {
				this.note('Ти кинув проєкт.');
				this.record(them, ['Ти кинув проєкт']);
				this.cheer(-6);
				this.state.clientInOffice = false;
				return false;
			}
			// клієнт іде, поки команда переробляє, і повертається на наступне коло
			this.state.clientInOffice = false;
			// Гравець відмітив, які правки беремо; решту команда тихо ігнорує.
			const picks = d.action === 'retry' && d.picks ? d.picks : c.demands.map((_, i) => i);
			const pm = pickMood(c.mood, c.demands.length, picks, c.cringe);
			const taken = picks.map((i) => c.demands[i]).filter(Boolean);
			const skipped = c.demands.filter((_, i) => !picks.includes(i));
			this.state.verdicts = this.state.verdicts.map((x) => (x === v ? { ...x, picked: picks, mood: pm.mood } : x));
			this.record(them, [`Беремо в роботу: ${taken.join('; ')}`, ...(skipped.length ? [`Тихо ігноруємо: ${skipped.join('; ')}`] : [])]);
			if (!pm.ok && !extended) {
				extended = true;
				rounds++;
				this.note(`${name} відчуває, що ${this.state.brief.client.gender === 'f' ? 'її' : 'його'} не почули: буде ще одне коло`);
				this.cheer(-3);
			}
			await this.rework(stage, 'клієнт', taken);
			for (const r of ROLES) this.tire(r, 3);
			// Після переробки — знову зведення: гравець бачить, яким став проєкт, і несе клієнту.
			this.idle();
			this.phase(playerPhase, `Переробили під правки клієнта. Глянь, що вийшло, і неси назад`, { strategist: 'table', copywriter: 'table', designer: 'table' });
			for (const r of ROLES) this.agent(r, 'idle', 'чекає твого рішення');
			await this.wait([playerPhase]);
			this.state.clientInOffice = true;
		}
		this.state.clientInOffice = false;
		return false;
	}

	/** Узгоджена переробка: позиціонування → назва й слоган → знак (або канали). */
	private async rework(stage: 'core' | 'content', who: 'керівник агенції' | 'клієнт', notes: string[]) {
		this.state.changed = [];
		this.phase(stage === 'core' ? 'rework_core' : 'rework_content', who === 'клієнт' ? 'Переробляємо під клієнта' : 'Команда враховує твої правки', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		if (stage === 'core') {
			this.work('platform', 3);
			this.step(who === 'клієнт' ? 'Стратегиня рятує суть від правок' : 'Стратегиня звіряє суть з твоїми правками');
			await this.gate();
			this.agent('strategist', 'thinking', 'переглядає позиціонування');
			const rp = normReposition(await this.ask('strategist', 'rework', prompt.reposition(who, notes, this.pos), SCHEMA.reposition, () => fake.reposition(who === 'клієнт')), this.pos);
			if (rp.changed) {
				this.pos = rp.pos;
				this.setEl('positioning', rp.pos.positioning, [`Роль: ${rp.pos.role}`, `Ворог: ${rp.pos.enemy}`], rp.why ? { why: rp.why } : {});
				this.bump('positioning');
			}
			this.say('strategist', rp.thought, 'thought', undefined, [rp.changed ? `Змінила: ${rp.why}` : 'Позиціонування лишила']);
			this.agent('strategist', 'done', rp.changed ? 'оновила позиціонування' : 'лишила позиціонування');
			this.tick();
			this.step(who === 'клієнт' ? 'Копірайтер вписує в слоган побажання кума' : 'Копірайтер підкручує слоган');

			await this.gate();
			const name = this.state.elements.name?.text ?? '', slogan = this.state.elements.slogan?.text ?? '';
			this.agent('copywriter', 'thinking', 'переглядає назву й слоган');
			const curIdea = this.state.elements.idea?.text ?? '';
			const rn = normRename(await this.ask('copywriter', 'rework', prompt.rename(who, notes, this.pos, rp.changed, name, slogan, curIdea), SCHEMA.rename, () => fake.rename(who === 'клієнт')), name, slogan);
			if (rn.changed) {
				if (rn.idea && rn.idea !== curIdea) { this.setEl('idea', rn.idea, this.state.elements.idea?.details ?? []); this.bump('idea'); }
				if (rn.name !== name) { this.setEl('name', rn.name, [], rn.why ? { why: rn.why } : {}); this.bump('name'); }
				if (rn.slogan !== slogan) { this.setEl('slogan', rn.slogan, []); this.bump('slogan'); }
			}
			this.say('copywriter', rn.thought, 'thought', undefined, [rn.changed ? `${rn.name} — «${rn.slogan}»: ${rn.why}` : 'Назву й слоган лишив']);
			this.agent('copywriter', 'done', rn.changed ? 'оновив назву' : 'лишив назву');
			this.tick();
			this.step(who === 'клієнт' ? 'Дизайнер робить логотип більшим. Зітхає' : 'Дизайнер підправляє знак');

			await this.gate();
			this.agent('designer', 'thinking', 'переглядає знак');
			const lg = await this.drawLogo('rework', prompt.relogo(who, notes, this.pos, this.state.elements.name?.text ?? ''));
			this.setEl('logo', lg.concept, [], { logo: lg.logo, why: lg.thought });
			this.record('logo', [`Після правок (${who}): ${lg.concept}`], lg.logo);
			this.bump('logo');
			this.say('designer', lg.thought, 'thought', undefined, [lg.concept]);
			this.agent('designer', 'done', 'оновив знак');
			this.tick();
		} else {
			this.work('comms', CONTENT.length + 1);
			this.step(who === 'клієнт' ? 'Вліплюють QR-код, «АКЦІЮ» і телефон' : 'Враховують твої правки');
			await Promise.all(CONTENT.map(async (id) => {
				const r = ELEMENT_OWNER[id];
				const cur = this.state.elements[id];
				if (!cur) return;
				await this.gate();
				this.agent(r, 'thinking', `переробляє ${ELEMENT_TITLE[id]}`);
				const out = normContent(id, await this.ask(r, 'rework', prompt.recontent(id, who, notes, cur), SCHEMA[id], () => fake.content(id)));
				this.setEl(id, out.text || cur.text, out.details.length ? out.details : cur.details);
				this.bump(id);
				this.say(r, out.thought);
				this.agent(r, 'done', 'переробив');
				this.tick();
			}));
			this.step('Дизайнер перемальовує банер і обкладинку');
			await this.images();
			this.tick();
		}
	}

	private pack(): string {
		const e = this.state.elements;
		const budget = this.state.brief.budget;
		return [`- Позиціонування: ${this.pos.positioning}`, `- Роль бренду: ${this.pos.role}; ворог: ${this.pos.enemy}`, `- Креативна ідея: ${e.idea?.text ?? '—'}`, ...(budget ? [`- Рекламний бюджет: ${budget.toLocaleString('uk-UA')} ₴ — шукаємо дешеві віральні ходи, телевізор і білборди його зʼїдять`] : []), `- Назва: ${e.name?.text ?? '—'}`, `- Слоган: ${e.slogan?.text ?? '—'}`, `- Знак: ${e.logo?.text ?? '—'}`].join('\n');
	}

	private async contentStep(id: ContentElement) {
		const r = ELEMENT_OWNER[id];
		await this.gate();
		this.agent(r, 'thinking', `робить ${ELEMENT_TITLE[id]}`);
		const out = normContent(id, await this.ask(r, 'content', prompt.content(id, this.pack()), SCHEMA[id], () => fake.content(id)));
		this.setEl(id, out.text, out.details);
		this.say(r, out.thought, 'thought', undefined, [out.text, ...out.details]);
		this.record('content', [`${ELEMENT_TITLE[id]}: ${[out.text, ...out.details].join(' · ')}`]);
		this.agent(r, 'done', `${ELEMENT_TITLE[id]} готово`);
	}

	/** Банер Instagram і обкладинка YouTube у піксельному стилі гри (Gemini). Без ключа — заглушки; збій картинки бриф не валить. */
	private async images() {
		await this.gate();
		this.phase('images', 'Дизайнер малює банер і обкладинку ролика', { designer: 'desk' });
		this.agent('designer', 'thinking', 'малює банер і обкладинку');
		const e = this.state.elements;
		const logoPng = e.logo?.logo ? rasterLogo(e.logo.logo, 256) : null;
		const refs = logoPng ? [{ mime: 'image/png', data: logoPng }] : [];
		// Стиль описуємо словами, без назв ігор: з назвою Gemini малював персонажів тієї гри.
		const STYLE = 'Cozy 16-bit pixel art: chunky visible pixels, warm saturated palette, dark coloured outlines (not black), soft dithering, no photorealism, no 3D-render gradients. All people are original characters invented for this ad, ordinary Ukrainians; do not depict or imitate characters from any existing video game, cartoon or film.';
		const mark = logoPng ? 'Place the provided pixel logo (first image) as the brand mark, keep its shapes and colours exactly.' : '';
		const colours = `Use the brand colours ${e.logo?.logo?.palette.a ?? ''} and ${e.logo?.logo?.palette.b ?? ''}. All text must be crisp pixel text, spelled exactly, nothing else written.`;
		// Чим менше тексту просимо намалювати, тим менше Gemini його калічить: на обкладинці — лише назва ролика.
		const extras = (e.instagram?.details ?? []).slice(1).join('; ');
		const jobs: { id: 'instagram' | 'youtube'; prompt: string; aspect: '1:1' | '16:9' }[] = [
			{
				id: 'instagram', aspect: '1:1',
				prompt: `${STYLE}\nA square Instagram ad banner for the brand «${e.name?.text ?? ''}».\nText on the banner, spelled exactly in Ukrainian, nothing else written: the headline «${e.instagram?.text ?? ''}» in big pixel letters${extras ? `, plus these client-requested elements drawn as they are: ${extras}` : ''}.\nScene: ${e.instagram?.details[0] ?? ''}.\nAny phone screen, sign, paper or label in the scene shows simple shapes or blank lines, never small text or made-up words.\n${mark} Put it in a corner.\n${colours}`
			},
			{
				id: 'youtube', aspect: '16:9',
				prompt: `${STYLE}\nA simple storyboard sheet for a short funny ad video: a 2×2 grid of four pixel-art frames with thin dark borders on a light paper background.\nThe ONLY text allowed: one big digit in the top-left corner of each frame — 1, 2, 3, 4. No words, no captions, no titles anywhere.\nFrames (describe only the picture; any sign, screen, poster or paper in a frame stays blank, without letters; never write frame titles or labels):\n${(e.youtube?.details ?? []).slice(0, 4).map((x, i) => `${i + 1}. ${sceneOnly(x)}`).join('\n')}\n${mark ? 'In frame 4 show the provided logo small.' : ''}\nUse the brand colours ${e.logo?.logo?.palette.a ?? ''} and ${e.logo?.logo?.palette.b ?? ''}.`
			}
		];
		await Promise.all(jobs.map(async (j) => {
			try {
				const started = Date.now();
				const img = await this.deps.images.generate(j.prompt, refs, { aspect: j.aspect, who: `${this.id}:${j.id}`, signal: this.abort.signal });
				this.alive();
				const dir = join(this.deps.dataDir, 'images', this.id);
				mkdirSync(dir, { recursive: true });
				const file = `${j.id}-${Date.now().toString(36)}.${img.mime.includes('png') ? 'png' : 'jpg'}`;
				writeFileSync(join(dir, file), img.data);
				this.state.imagesUsd += img.usd;
				this.deps.onSpend?.('gemini', img.usd);
				this.trace.push({ t: new Date().toISOString(), purpose: 'image', who: j.id, model: this.deps.images.demo ? 'demo' : 'gemini', prompt: j.prompt, response: file, stop: null, ms: Date.now() - started, usd: img.usd });
				const cur = this.state.elements[j.id];
				if (cur) this.setEl(j.id, cur.text, cur.details, { image: `/api/images/${this.id}/${file}` });
			} catch (err) {
				if (isAbortError(err)) throw err;
				const lost = Number((err as { usd?: number }).usd) || 0;
				if (lost) { this.state.imagesUsd += lost; this.deps.onSpend?.('gemini', lost); }
				log('warn', 'image_failed', { run: this.id, id: j.id, msg: String((err as Error).message).slice(0, 200) });
				this.note(`Картинка «${ELEMENT_TITLE[j.id]}» не вийшла: ${(err as Error).message.slice(0, 120)}`);
			}
		}));
		this.agent('designer', 'done', 'картинки готові');
	}

	drop() {
		if (this.state.phase === 'done') return;
		const failed = this.state.phase === 'failed';
		this.abort.abort();
		this.waiter = null;
		this.resume?.();
		this.finish('dropped', failed);
	}

	/* ─────────── фінал ─────────── */

	private finish(verdict: 'ok' | 'reject' | 'dropped', free = false) {
		const elements = Object.values(this.state.elements).filter((e): e is ElementValue => !!e);
		const { quality, notes, performanceHits } = qualityOf(elements);
		const fee = this.state.brief.fee;
		const prepay = this.state.brief.prepay;
		const pay: RunResult['pay'] = [
			{ label: 'Передплата 20% (прийшла на старті)', amount: prepay },
			{ label: this.contentAccepted ? 'Клієнт прийняв усе: решта 80%' : 'Решта 80% — лише якщо клієнт прийме все', amount: this.contentAccepted ? fee - prepay : 0 }
		];
		const paid = pay.reduce((n, p) => n + p.amount, 0);
		if (verdict === 'reject') for (const r of ROLES) this.tire(r, 8);
		if (verdict === 'dropped' && !free) this.cheer(-6);
		const repDelta = free ? 0 : reputationDelta(quality, verdict);
		const result: RunResult = {
			verdict, paid, pay, repDelta, quality,
			notes: [
				...notes.filter((n) => !n.ok).map((n) => `${ELEMENT_TITLE[n.element]}: ${n.text}`),
				...(performanceHits ? ['Клієнт протягнув перфоманс-штампи — індустрія це бачить.'] : [])
			],
			burnoutDelta: { ...this.burnoutDelta },
			moraleDelta: { ...this.moraleDelta }
		};
		this.state.result = result;
		this.state.clientInOffice = false;
		this.state.paused = false;
		this.record('done', pay.map((p) => `${p.label}: ${p.amount.toLocaleString('uk-UA')} ₴`));
		for (const r of ROLES) {
			this.state.agents[r].status = this.burnoutOf(r) >= 85 ? 'tired' : 'idle';
			this.state.agents[r].spot = 'coffee';
			this.state.agents[r].doing = verdict === 'ok' ? 'святкує з кавою' : 'пʼє каву мовчки';
		}
		const word = verdict === 'ok' ? 'Клієнт заплатив усе' : 'Проєкт кинуто';
		this.phase('done', `${word}: +${paid.toLocaleString('uk-UA')} ₴, репутація ${repDelta >= 0 ? '+' : ''}${repDelta}`);
		log('info', 'run_done', { run: this.id, verdict, paid, repDelta, quality, calls: this.state.calls, usd: Number(this.state.costUsd.toFixed(4)), images_usd: this.state.imagesUsd });
		this.deps.onFinish?.(this);
	}
}

export { ROLE_NAME };
