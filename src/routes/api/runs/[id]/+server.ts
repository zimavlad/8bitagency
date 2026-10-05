import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';

export function GET({ params, locals }) {
	const run = app(locals.pid).run(params.id);
	if (!run) return json({ error: 'Бриф не знайдено.' }, { status: 404 });
	return json({ state: run.state });
}
