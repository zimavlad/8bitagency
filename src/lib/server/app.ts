import { AnthropicModel } from './model/anthropic';
import { FakeModel } from './model/fake';
import { Game } from './game/game';

/**
 * Один процес — одна гра. Ключ Claude лише в змінних оточення сервера; без ключа гра йде
 * на підставній моделі й нічого не коштує (позначка «демо» в шапці).
 */
let game: Game | null = null;

export function app(): Game {
	if (game) return game;
	const env = process.env;
	const key = env.ANTHROPIC_API_KEY?.trim();
	const model = key ? new AnthropicModel(key) : new FakeModel({ delayMs: [Number(env.DEMO_MIN_MS ?? 900), Number(env.DEMO_MAX_MS ?? 1800)] });
	game = new Game({
		dataDir: env.DATA_DIR ?? './data',
		model,
		models: {
			agent: env.AGENCY_MODEL ?? 'claude-sonnet-5-5',
			review: env.REVIEW_MODEL ?? 'claude-opus-5-5',
			client: env.CLIENT_MODEL ?? 'claude-sonnet-5-5',
			gpt: env.GPT_MODEL ?? 'claude-haiku-4-5'
		}
	});
	console.log(JSON.stringify({ ev: 'start', mode: key ? 'claude' : 'demo', data: env.DATA_DIR ?? './data' }));
	return game;
}
