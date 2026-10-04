import { log } from './log';
import { AnthropicModel } from './model/anthropic';
import { FakeModel } from './model/fake';
import { FakeImages, GeminiImages, IMAGE_MODEL } from './model/images';
import { Game } from './game/game';

/**
 * Один процес — одна гра. Ключі Claude і Gemini лише в змінних оточення сервера; без ключа
 * відповідає підставна модель (позначка «демо»), без ключа Gemini — піксельні заглушки.
 */
let game: Game | null = null;

export function app(): Game {
	if (game) return game;
	const env = process.env;
	const key = env.ANTHROPIC_API_KEY?.trim();
	const gkey = env.GEMINI_API_KEY?.trim();
	const model = key ? new AnthropicModel(key) : new FakeModel({ delayMs: [Number(env.DEMO_MIN_MS ?? 900), Number(env.DEMO_MAX_MS ?? 1800)] });
	const images = gkey ? new GeminiImages(gkey, env.IMAGE_MODEL ?? IMAGE_MODEL) : new FakeImages();
	game = new Game({
		dataDir: env.DATA_DIR ?? './data',
		model,
		images,
		models: {
			agent: env.AGENCY_MODEL ?? 'claude-sonnet-5-5',
			review: env.REVIEW_MODEL ?? 'claude-opus-5-5',
			client: env.CLIENT_MODEL ?? 'claude-sonnet-5-5',
			gpt: env.GPT_MODEL ?? 'claude-haiku-4-5'
		}
	});
	log('info', 'start', { mode: key ? 'claude' : 'demo', images: gkey ? 'gemini' : 'demo', data: env.DATA_DIR ?? './data', admin: !!env.ADMIN_TOKEN });
	return game;
}

/** Доступ до логів, архіву й бази знань: Bearer ADMIN_TOKEN. Без змінної — закрито. */
export function isAdmin(req: Request): boolean {
	const t = process.env.ADMIN_TOKEN?.trim();
	if (!t || t.length < 16) return false;
	const h = req.headers.get('authorization') ?? '';
	return h === `Bearer ${t}`;
}
