import { json } from '@sveltejs/kit';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isAdmin } from '$lib/server/app';
import { log } from '$lib/server/log';

const ROLES = ['strategist', 'copywriter', 'designer'];
const ok = (role: string, file: string) => ROLES.includes(role) && /^[\w.-]{1,120}\.(md|txt|pdf)$/i.test(file) && !file.startsWith('.');

/** Покласти файл у базу Джіпітенка: PUT з сирим тілом. База перечитується сама. */
export async function PUT({ request, params }) {
	if (!isAdmin(request)) return json({ error: 'Потрібен ADMIN_TOKEN.' }, { status: 401 });
	if (!ok(params.role, params.file)) return json({ error: 'Невірна роль або імʼя файлу.' }, { status: 400 });
	const dir = join(process.env.DATA_DIR ?? './data', 'knowledge', params.role);
	await mkdir(dir, { recursive: true });
	const body = Buffer.from(await request.arrayBuffer());
	await writeFile(join(dir, params.file), body);
	log('info', 'kb_upload', { role: params.role, file: params.file, bytes: body.length });
	return json({ ok: true, bytes: body.length });
}

export async function DELETE({ request, params }) {
	if (!isAdmin(request)) return json({ error: 'Потрібен ADMIN_TOKEN.' }, { status: 401 });
	if (!ok(params.role, params.file)) return json({ error: 'Невірна роль або імʼя файлу.' }, { status: 400 });
	try {
		await unlink(join(process.env.DATA_DIR ?? './data', 'knowledge', params.role, params.file));
	} catch {
		return json({ error: 'Нема такого файлу.' }, { status: 404 });
	}
	return json({ ok: true });
}
