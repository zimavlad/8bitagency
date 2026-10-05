import { log } from './log';
import { AnthropicModel } from './model/anthropic';
import { FakeModel } from './model/fake';
import { FakeImages, GeminiImages, IMAGE_MODEL } from './model/images';
import { join } from 'node:path';
import { Game } from './game/game';
import type { Models } from './game/run';
import type { ModelClient } from './model/client';
import type { ImageModel } from './model/images';
import { NotebookLM } from './notebooks';

/**
 * Кожен гравець — своя гра (сейв <DATA_DIR>/players/<id>.json), гравця впізнаємо за cookie.
 * Модель, картинки, база знань, архів і рахунки API — спільні на сервер.
 * Ключі Claude і Gemini лише в змінних оточення; без ключа — підставна модель (позначка «демо»).
 */
let shared: { model: ModelClient; images: ImageModel; dataDir: string; models: Models; paceMs: number; notebooks: NotebookLM } | null = null;
const games = new Map<string, Game>();

function boot() {
	if (shared) return shared;
	const env = process.env;
	const key = env.ANTHROPIC_API_KEY?.trim();
	const gkey = env.GEMINI_API_KEY?.trim();
	shared = {
		model: key ? new AnthropicModel(key) : new FakeModel({ delayMs: [Number(env.DEMO_MIN_MS ?? 900), Number(env.DEMO_MAX_MS ?? 1800)] }),
		images: gkey ? new GeminiImages(gkey, env.IMAGE_MODEL ?? IMAGE_MODEL) : new FakeImages(),
		dataDir: env.DATA_DIR ?? './data',
		models: {
			agent: env.AGENCY_MODEL ?? 'claude-sonnet-5-5',
			review: env.REVIEW_MODEL ?? 'claude-opus-5-5',
			client: env.CLIENT_MODEL ?? 'claude-sonnet-5-5',
			gpt: env.GPT_MODEL ?? 'claude-haiku-4-5'
		},
		// Кожен крок команди триває щонайменше стільки — щоб встигати читати бабли й прогрес.
		paceMs: Number(env.PACE_MS ?? 6500),
		notebooks: new NotebookLM(env.DATA_DIR ?? './data')
	};
	log('info', 'start', { mode: key ? 'claude' : 'demo', images: gkey ? 'gemini' : 'demo', data: shared.dataDir, admin: !!env.ADMIN_TOKEN });
	return shared;
}

/** Ідентифікатор гравця: лише латиниця, цифри й дефіс. */
export const validPlayer = (p: string | undefined): p is string => !!p && /^[a-z0-9-]{8,40}$/.test(p);

/** Блокноти NotebookLM — спільні на сервер (один браузер, один денний ліміт). */
export function notebooks(): NotebookLM {
	return boot().notebooks;
}

export function app(player = 'main'): Game {
	const id = validPlayer(player) ? player : 'main';
	let g = games.get(id);
	if (!g) {
		const s = boot();
		g = new Game({ ...s, player: id, saveFile: join(s.dataDir, 'players', `${id}.json`) });
		games.set(id, g);
		log('info', 'player_load', { player: id, day: g.state.day, money: g.state.money });
	}
	return g;
}

/** Доступ до логів, архіву й бази знань: Bearer ADMIN_TOKEN. Без змінної — закрито. */
export function isAdmin(req: Request): boolean {
	const t = process.env.ADMIN_TOKEN?.trim();
	if (!t || t.length < 16) return false;
	const h = req.headers.get('authorization') ?? '';
	return h === `Bearer ${t}`;
}
