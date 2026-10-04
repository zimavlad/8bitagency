import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Картинки Gemini з тому /data. Імена перевіряємо, щоб не вийти за межі теки. */
export async function GET({ params }) {
	if (!/^r[a-z0-9]+$/.test(params.run) || !/^[a-z]+-[a-z0-9]+\.(png|jpg)$/.test(params.file)) return new Response('not found', { status: 404 });
	try {
		const data = await readFile(join(process.env.DATA_DIR ?? './data', 'images', params.run, params.file));
		return new Response(data, { headers: { 'content-type': params.file.endsWith('png') ? 'image/png' : 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
	} catch {
		return new Response('not found', { status: 404 });
	}
}
