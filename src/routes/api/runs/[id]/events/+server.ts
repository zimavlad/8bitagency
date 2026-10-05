import { app } from '$lib/server/app';

/** Живий стан брифу (SSE). Після перепідключення клієнт одразу отримує повний стан. */
export function GET({ params, request, locals }) {
	const g = app(locals.pid);
	const run = g.run(params.id);
	if (!run) return new Response('not found', { status: 404 });
	const enc = new TextEncoder();
	let off = () => {};
	let ping: ReturnType<typeof setInterval>;
	const stream = new ReadableStream({
		start(c) {
			const send = () => {
				try {
					c.enqueue(enc.encode(`data: ${JSON.stringify({ state: run.state })}\n\n`));
				} catch {
					off();
				}
			};
			send();
			off = g.subscribe(run.id, send);
			ping = setInterval(() => {
				try {
					c.enqueue(enc.encode(': ping\n\n'));
				} catch {
					clearInterval(ping);
				}
			}, 20000);
			request.signal.addEventListener('abort', () => {
				off();
				clearInterval(ping);
				try {
					c.close();
				} catch {
					// уже закрито
				}
			});
		},
		cancel() {
			off();
			clearInterval(ping);
		}
	});
	return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' } });
}
