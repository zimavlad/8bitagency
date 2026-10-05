import type { Usage } from './model/client';

/** Ціни Anthropic, долари за 1 млн токенів. Звірено з довідником Anthropic 05.10.2026. */
export const PRICES_AS_OF = '2026-10-05';

const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
	'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
	'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
	'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }
};

export function costUsd(model: string, u: Usage): number {
	// Невідома модель (наприклад, сервер переключив на резервну через відмову) — рахуємо за найдорожчою з наших, а не нулем.
	const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(`${k}-`)) ?? 'claude-opus-5-5';
	const p = PRICES[key];
	return (u.input_tokens * p.input + u.output_tokens * p.output + u.cache_read_input_tokens * p.cacheRead + u.cache_creation_input_tokens * p.cacheWrite) / 1e6;
}
