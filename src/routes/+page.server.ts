import { app } from '$lib/server/app';
import { kbStats } from '$lib/server/game/kb';

export async function load() {
	const g = app();
	return { game: g.state, demo: g.demo, kb: await kbStats(process.env.DATA_DIR ?? './data') };
}
