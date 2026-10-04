import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';
import { CONTENT, CORE, type ElementId } from '$lib/types';

const IDS: string[] = [...CORE, ...CONTENT];

/** Дії гравця: {action: 'edit', element, comment} | {action: 'approve', element} | {action: 'submit'} | {action: 'drop'} */
export async function POST({ params, request }) {
	const run = app().run(params.id);
	if (!run) return json({ error: 'Бриф не знайдено.' }, { status: 404 });
	const b = (await request.json().catch(() => ({}))) as { action?: string; element?: string; comment?: string };
	let error: string | null = null;
	if (b.action === 'edit' || b.action === 'approve') {
		if (!b.element || !IDS.includes(b.element)) return json({ error: 'Невідомий елемент.' }, { status: 400 });
		error = b.action === 'edit' ? await run.edit(b.element as ElementId, String(b.comment ?? '')) : run.approve(b.element as ElementId);
	} else if (b.action === 'submit') error = run.submit();
	else if (b.action === 'drop') run.drop();
	else return json({ error: 'Невідома дія.' }, { status: 400 });
	if (error) return json({ error }, { status: 409 });
	return json({ state: run.state, editsLeft: run.editsLeft() });
}
