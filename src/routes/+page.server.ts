import { app } from '$lib/server/app';
import { kbStats } from '$lib/server/game/kb';

export async function load({ locals }) {
	const g = app(locals.pid);
	return { game: g.view(), demo: g.demo, imagesDemo: g.imagesDemo, kb: await kbStats(process.env.DATA_DIR ?? './data') };
}
