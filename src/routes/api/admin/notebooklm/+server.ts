import { json } from '@sveltejs/kit';
import { isAdmin, notebooks } from '$lib/server/app';

/** Стан NotebookLM: чи є вхід, скільки питань сьогодні, що каже MCP. */
export async function GET({ request }) {
	if (!isAdmin(request)) return json({ error: 'Потрібен ADMIN_TOKEN.' }, { status: 401 });
	return json(await notebooks().health());
}

/** Вхід у Google: JSON з Cookie-Editor (сторінка notebooklm.google.com) або {question, owner} — пробне питання. */
export async function POST({ request }) {
	if (!isAdmin(request)) return json({ error: 'Потрібен ADMIN_TOKEN.' }, { status: 401 });
	const body = (await request.json().catch(() => null)) as { cookies?: unknown; question?: string; owner?: 'gpt' | 'strategist' | 'copywriter' } | null;
	if (!body) return json({ error: 'Порожньо.' }, { status: 400 });
	if (body.question) {
		const answer = await notebooks().ask(body.owner ?? 'gpt', String(body.question).slice(0, 500));
		return json({ answer });
	}
	const r = await notebooks().importCookies(body.cookies ?? body);
	return json(r, { status: r.ok ? 200 : 400 });
}
