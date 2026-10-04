import { json } from '@sveltejs/kit';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isAdmin } from '$lib/server/app';

/** Список архівних прогонів, найновіші першими. */
export async function GET({ request }) {
	if (!isAdmin(request)) return json({ error: 'Потрібен ADMIN_TOKEN.' }, { status: 401 });
	const dir = join(process.env.DATA_DIR ?? './data', 'runs');
	let files: string[] = [];
	try {
		files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
	} catch {
		return json([]);
	}
	const items = await Promise.all(files.map(async (f) => ({ id: f.replace(/\.json$/, ''), mtime: (await stat(join(dir, f))).mtime.toISOString() })));
	return json(items.sort((a, b) => b.mtime.localeCompare(a.mtime)));
}
