import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';

/** Старт брифу: {briefId} з вхідних або {custom: {text, business}}. */
export async function POST({ request }) {
	const body = (await request.json().catch(() => ({}))) as { briefId?: string; custom?: { text?: string; business?: string } };
	const custom = body.custom ? { text: String(body.custom.text ?? ''), business: String(body.custom.business ?? '') } : undefined;
	const { run, error } = app().start({ briefId: body.briefId, custom });
	if (error || !run) return json({ error }, { status: 409 });
	return json({ id: run.id, state: run.state });
}
