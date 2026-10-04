import { json } from '@sveltejs/kit';
import { app } from '$lib/server/app';
import { kbStats } from '$lib/server/game/kb';

export async function GET() {
	const g = app();
	return json({ game: g.state, demo: g.demo, imagesDemo: g.imagesDemo, kb: await kbStats(process.env.DATA_DIR ?? './data') });
}

/** {action: 'rest' | 'reset' | 'balance', provider?, usd?} */
export async function POST({ request }) {
	const g = app();
	const b = (await request.json().catch(() => ({}))) as { action?: string; provider?: string; usd?: number };
	let err: string | null = null;
	if (b.action === 'rest') err = g.rest();
	else if (b.action === 'reset') g.reset();
	else if (b.action === 'balance' && (b.provider === 'claude' || b.provider === 'gemini')) err = g.setBalance(b.provider, Number(b.usd));
	else return json({ error: 'Невідома дія.' }, { status: 400 });
	if (err) return json({ error: err }, { status: 409 });
	return json({ game: g.state });
}
