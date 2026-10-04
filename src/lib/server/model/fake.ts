import type { CallOptions, ModelClient, ModelResult, RequestParams } from './client';

/**
 * Підставна модель: віддає відповідь, яку підготував рушій (opts.fake), з паузою як у справжньої.
 * Записує всі запити — на цьому стоять тести «хто що бачить».
 */
export class FakeModel implements ModelClient {
	readonly name = 'demo';
	readonly demo = true;
	readonly requests: { params: RequestParams; purpose: string; who: string }[] = [];

	constructor(private opts: { delayMs?: [number, number] } = {}) {}

	async call(params: RequestParams, opts: CallOptions): Promise<ModelResult> {
		this.requests.push({ params: structuredClone(params), purpose: opts.purpose, who: opts.who });
		const [lo, hi] = this.opts.delayMs ?? [0, 0];
		if (hi > 0) await sleep(lo + Math.random() * (hi - lo), opts.signal);
		const text = JSON.stringify(opts.fake());
		return {
			content: [{ type: 'text', text }],
			text,
			stopReason: 'end_turn',
			model: 'demo',
			usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
		};
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(abortError());
		const t = setTimeout(resolve, ms);
		signal?.addEventListener('abort', () => {
			clearTimeout(t);
			reject(abortError());
		}, { once: true });
	});
}

function abortError(): Error {
	const e = new Error('aborted');
	e.name = 'AbortError';
	return e;
}
