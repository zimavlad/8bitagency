import { encodePng } from '../png';
import { log, errFields } from '../log';

/** Ціна картинки Nano Banana 2 — оцінка; звіряй з балансом у консолі Google AI Studio. */
export const IMAGE_USD = 0.067;
export const IMAGE_MODEL = 'gemini-3.1-flash-image';

export interface ImageResult {
	data: Buffer;
	mime: string;
	usd: number;
}

export interface ImageModel {
	readonly demo: boolean;
	generate(prompt: string, refs: { mime: string; data: Buffer }[], o: { aspect: '1:1' | '16:9'; who: string; signal?: AbortSignal }): Promise<ImageResult>;
}

/** Gemini (Nano Banana). Ключ — лише в змінних сервера. */
export class GeminiImages implements ImageModel {
	readonly demo = false;
	constructor(private key: string, private model = IMAGE_MODEL) {}

	async generate(prompt: string, refs: { mime: string; data: Buffer }[], o: { aspect: '1:1' | '16:9'; who: string; signal?: AbortSignal }): Promise<ImageResult> {
		const started = Date.now();
		const body = {
			contents: [{ parts: [...refs.map((r) => ({ inlineData: { mimeType: r.mime, data: r.data.toString('base64') } })), { text: prompt }] }],
			generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: o.aspect } }
		};
		try {
			const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'x-goog-api-key': this.key },
				body: JSON.stringify(body),
				signal: o.signal
			});
			const j = (await r.json()) as { error?: { message?: string; status?: string }; candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[]; usageMetadata?: Record<string, unknown> };
			if (!r.ok || j.error) throw Object.assign(new Error(j.error?.message ?? `Gemini ${r.status}`), { status: r.status });
			const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
			if (!part?.inlineData) throw new Error('Gemini не повернув картинку');
			log('info', 'image_call', { who: o.who, model: this.model, ms: Date.now() - started, usage: j.usageMetadata, usd: IMAGE_USD });
			return { data: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType, usd: IMAGE_USD };
		} catch (e) {
			log('error', 'image_call_failed', { who: o.who, ms: Date.now() - started, ...errFields(e) });
			throw e;
		}
	}
}

/** Без ключа: піксельна заглушка, щоб гра проходила до кінця безкоштовно. */
export class FakeImages implements ImageModel {
	readonly demo = true;
	readonly prompts: string[] = [];
	async generate(prompt: string, _refs: unknown[], o: { aspect: '1:1' | '16:9' }): Promise<ImageResult> {
		this.prompts.push(prompt);
		const w = o.aspect === '1:1' ? 96 : 160, h = o.aspect === '1:1' ? 96 : 90;
		const px = new Uint8Array(w * h * 4);
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const i = (y * w + x) * 4, c = ((x >> 3) + (y >> 3)) % 2;
				px[i] = c ? 233 : 201; px[i + 1] = c ? 196 : 147; px[i + 2] = c ? 149 : 90; px[i + 3] = 255;
			}
		return { data: encodePng(w, h, px), mime: 'image/png', usd: 0 };
	}
}
