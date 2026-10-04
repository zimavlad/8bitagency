import { json } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/app';
import { readLogs, type Level } from '$lib/server/log';

export function GET({ request, url }) {
	if (!isAdmin(request)) return json({ error: 'Потрібен ADMIN_TOKEN.' }, { status: 401 });
	const level = url.searchParams.get('level') as Level | null;
	return json(readLogs(Number(url.searchParams.get('days') ?? 1), Number(url.searchParams.get('lines') ?? 500), level ?? undefined));
}
