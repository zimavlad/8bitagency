import { json } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isAdmin } from '$lib/server/app';

export async function GET({ request, params }) {
	if (!isAdmin(request)) return json({ error: 'Потрібен ADMIN_TOKEN.' }, { status: 401 });
	if (!/^r[a-z0-9]+$/.test(params.id)) return json({ error: 'Невірний id.' }, { status: 400 });
	try {
		return new Response(await readFile(join(process.env.DATA_DIR ?? './data', 'runs', `${params.id}.json`)), { headers: { 'content-type': 'application/json' } });
	} catch {
		return json({ error: 'Нема такого прогону.' }, { status: 404 });
	}
}
