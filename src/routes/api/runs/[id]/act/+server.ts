import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';
import type { Decision } from '$lib/server/game/run';

/**
 * Дії гравця: pick {index} · submit · edit {notes[]} · retry · giveup · pause {on} · drop.
 */
export async function POST({ params, request, locals }) {
	const run = app(locals.pid).run(params.id);
	if (!run) return json({ error: 'Бриф не знайдено.' }, { status: 404 });
	const b = (await request.json().catch(() => ({}))) as { action?: string; index?: number; notes?: unknown; on?: boolean; picks?: unknown };
	let error: string | null = null;
	switch (b.action) {
		case 'pick': error = run.decide({ action: 'pick', index: Number(b.index) }); break;
		case 'retry': error = run.decide({ action: 'retry', picks: Array.isArray(b.picks) ? b.picks.map(Number).filter(Number.isInteger).slice(0, 7) : undefined }); break;
		case 'submit': case 'giveup': case 'continue': case 'more': error = run.decide({ action: b.action } as Decision); break;
		case 'edit': error = run.decide({ action: 'edit', notes: Array.isArray(b.notes) ? b.notes.map(String).slice(0, 5) : [] }); break;
		case 'feedback': error = run.decide({ action: 'feedback', notes: Array.isArray(b.notes) ? b.notes.map(String).slice(0, 5) : [] }); break;
		case 'pause': run.setPaused(!!b.on); break;
		case 'drop': run.drop(); break;
		default: return json({ error: 'Невідома дія.' }, { status: 400 });
	}
	if (error) return json({ error }, { status: 409 });
	// Даємо сценарію дійти до наступного кроку (клієнт заходить, команда сідає), щоб відповідь уже показувала зміну.
	await new Promise((r) => setTimeout(r, 30));
	return json({ state: run.state });
}
