import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';

export function GET({ params }) {
	const run = app().run(params.id);
	if (!run) return json({ error: 'Бриф не знайдено.' }, { status: 404 });
	return json({ state: run.state });
}
