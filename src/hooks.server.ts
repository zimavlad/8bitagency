import { json, redirect, type Handle } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { validPlayer } from '$lib/server/app';
import { COOKIE, validToken } from '$lib/server/auth';

const OPEN = (p: string) => p === '/login' || p.startsWith('/_app/') || p === '/favicon.svg';

export const handle: Handle = async ({ event, resolve }) => {
	const p = event.url.pathname;
	if (!OPEN(p) && !validToken(event.cookies.get(COOKIE))) {
		if (p.startsWith('/api/')) return json({ error: 'Потрібен вхід.' }, { status: 401 });
		redirect(303, '/login');
	}
	// Кожен браузер — свій гравець і своя агенція.
	let pid = event.cookies.get('pid');
	if (!validPlayer(pid)) {
		pid = randomBytes(9).toString('hex');
		event.cookies.set('pid', pid, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, secure: event.url.protocol === 'https:' });
	}
	event.locals.pid = pid;
	const res = await resolve(event);
	// JS і CSS без кешу, крім незмінних файлів збірки, — щоб після редеплою не жила стара половина коду.
	if (!p.startsWith('/_app/immutable/') && /\.(js|css)$/.test(p)) res.headers.set('cache-control', 'no-cache');
	return res;
};
