import type Anthropic from '@anthropic-ai/sdk';

export type RequestParams = Anthropic.MessageCreateParamsNonStreaming;

export type CallPurpose = 'read' | 'review' | 'core' | 'rework' | 'gpt' | 'client' | 'content';

export interface Usage {
	input_tokens: number;
	output_tokens: number;
	cache_read_input_tokens: number;
	cache_creation_input_tokens: number;
}

export interface ModelResult {
	/** Блоки відповіді як від API — у наступні запити агента вони йдуть без змін. */
	content: Anthropic.ContentBlockParam[];
	text: string;
	stopReason: string | null;
	model: string;
	usage: Usage;
}

export interface CallOptions {
	purpose: CallPurpose;
	/** Для журналу: чий виклик. Вміст брифів і відповідей у журнал не пишемо. */
	who: string;
	signal?: AbortSignal;
	/** Відповідь для підставної моделі. Справжня модель це поле ігнорує. */
	fake: () => unknown;
}

export interface ModelClient {
	readonly name: string;
	readonly demo: boolean;
	call(params: RequestParams, opts: CallOptions): Promise<ModelResult>;
}

export function isAbortError(e: unknown): boolean {
	return e instanceof Error && (e.name === 'AbortError' || e.name === 'APIUserAbortError');
}
