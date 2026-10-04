import Anthropic from '@anthropic-ai/sdk';
import { costUsd } from '../pricing';
import { isAbortError, type CallOptions, type ModelClient, type ModelResult, type RequestParams } from './client';

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
			const m = await this.client.messages.create(params, { signal: opts.signal });
			const text = m.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
			const usage = {
				input_tokens: m.usage.input_tokens,
				output_tokens: m.usage.output_tokens,
				cache_read_input_tokens: m.usage.cache_read_input_tokens ?? 0,
				cache_creation_input_tokens: m.usage.cache_creation_input_tokens ?? 0
			};
			console.log(JSON.stringify({ ev: 'model_call', purpose: opts.purpose, who: opts.who, model: m.model, stop: m.stop_reason, ms: Date.now() - started, in: usage.input_tokens, out: usage.output_tokens, usd: Number(costUsd(m.model, usage).toFixed(4)) }));
			return { content: m.content as unknown as Anthropic.ContentBlockParam[], text, stopReason: m.stop_reason, model: m.model, usage };
		} catch (e) {
			if (!isAbortError(e)) console.log(JSON.stringify({ ev: 'model_call_failed', purpose: opts.purpose, who: opts.who, ms: Date.now() - started, err: e instanceof Error ? e.name : 'unknown' }));
			throw e;
		}
	}
}
