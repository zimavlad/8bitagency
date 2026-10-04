import Anthropic from '@anthropic-ai/sdk';
import { costUsd } from '../pricing';
import { errFields, log } from '../log';
import { isAbortError, type CallOptions, type ModelClient, type ModelResult, type RequestParams } from './client';

/** Моделі з класифікаторами, для яких є серверна запасна модель. */
const WITH_FALLBACK = /^claude-(opus-5|sonnet-5-5|fable-5)/;

/** Справжній Claude API. Тимчасові збої (429, 5xx, мережа) SDK повторює сам. */
export class AnthropicModel implements ModelClient {
	readonly name = 'claude';
	readonly demo = false;
	private client: Anthropic;

	constructor(apiKey: string) {
		this.client = new Anthropic({ apiKey, maxRetries: 4 });
	}

	async call(params: RequestParams, opts: CallOptions): Promise<ModelResult> {
		const started = Date.now();
		try {
			// Відмову класифікатора сервер перепроганяє на запасній моделі (як у synthetic_interviews).
			const fallback = WITH_FALLBACK.test(params.model);
			const body = (fallback ? { ...params, fallbacks: 'default' } : params) as RequestParams;
			const m = await this.client.messages.create(body, {
				signal: opts.signal,
				...(fallback ? { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } } : {})
			});
			const text = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
			const usage = {
				input_tokens: m.usage.input_tokens,
				output_tokens: m.usage.output_tokens,
				cache_read_input_tokens: m.usage.cache_read_input_tokens ?? 0,
				cache_creation_input_tokens: m.usage.cache_creation_input_tokens ?? 0
			};
			log(m.stop_reason === 'refusal' || m.stop_reason === 'max_tokens' ? 'warn' : 'info', 'model_call', { purpose: opts.purpose, who: opts.who, model: m.model, stop: m.stop_reason, served: m.model, ms: Date.now() - started, in: usage.input_tokens, out: usage.output_tokens, usd: Number(costUsd(m.model, usage).toFixed(4)) });
			return { content: m.content as unknown as Anthropic.ContentBlockParam[], text, stopReason: m.stop_reason, model: m.model, usage };
		} catch (e) {
			if (!isAbortError(e)) log('error', 'model_call_failed', { purpose: opts.purpose, who: opts.who, ms: Date.now() - started, ...errFields(e) });
			throw e;
		}
	}
}
