import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';
import type { BriefForm } from '$lib/types';

/** Старт брифу: {briefId} з вхідних або {custom: {business, goals, wishes, competitors, usp}}. */
export async function POST({ request }) {
	const body = (await request.json().catch(() => ({}))) as { briefId?: string; custom?: Partial<BriefForm> };
	const c = body.custom;
	const custom = c ? { business: String(c.business ?? ''), goals: String(c.goals ?? ''), wishes: String(c.wishes ?? ''), competitors: String(c.competitors ?? ''), usp: String(c.usp ?? '') } : undefined;
	const { run, error } = app().start({ briefId: body.briefId, custom });
	if (error || !run) return json({ error }, { status: 409 });
	return json({ id: run.id, state: run.state });
}
