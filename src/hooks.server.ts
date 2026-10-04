import type { Handle } from '@sveltejs/kit';
import { app } from '$lib/server/app';

app();

/** JS і CSS без кешу, крім незмінних файлів збірки, — щоб після редеплою не жила стара половина коду. */
export const handle: Handle = async ({ event, resolve }) => {
	const res = await resolve(event);
	const p = event.url.pathname;
	if (!p.startsWith('/_app/immutable/') && /\.(js|css)$/.test(p)) res.headers.set('cache-control', 'no-cache');
	return res;
};
