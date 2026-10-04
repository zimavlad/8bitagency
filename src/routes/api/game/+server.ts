import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';
import { kbStats } from '$lib/server/game/kb';

export async function GET() {
	const g = app();
	return json({ game: g.state, demo: g.demo, kb: await kbStats(process.env.DATA_DIR ?? './data') });
}

/** {action: 'rest' | 'reset'} */
export async function POST({ request }) {
	const g = app();
	const body = (await request.json().catch(() => ({}))) as { action?: string };
	if (body.action === 'rest') {
		const err = g.rest();
		if (err) return json({ error: err }, { status: 409 });
	} else if (body.action === 'reset') g.reset();
	else return json({ error: 'Невідома дія.' }, { status: 400 });
	return json({ game: g.state });
}
