import { describe, it, expect, beforeAll } from 'vitest';

const ctxProxy = (): any => new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : () => ctxProxy()), set: () => true });
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ctxProxy() });
beforeAll(() => {
	(globalThis as any).document = { createElement: () => fakeCanvas(), addEventListener() {}, removeEventListener() {}, hidden: false };
	(globalThis as any).window = { devicePixelRatio: 2 };
	(globalThis as any).ResizeObserver = class { observe() {} disconnect() {} };
	(globalThis as any).requestAnimationFrame = () => 1;
	(globalThis as any).cancelAnimationFrame = () => {};
});

const input: any = {
	agents: { strategist: { spot: 'desk', status: 'idle', burnout: 0 }, copywriter: { spot: 'desk', status: 'idle', burnout: 0 }, designer: { spot: 'desk', status: 'idle', burnout: 0 } },
	clientInOffice: false, gptFor: null, speaking: [], board: { positioning: false, name: false, slogan: false, logo: false }, logo: null, hour: 12, sky: 'clear', reducedMotion: true, client: { gender: 'm', look: 'leather' }, away: false
};

async function mk(w: number, h: number, dpr = 2, view?: { reserve?: number; fill?: boolean }) {
	(globalThis as any).window.devicePixelRatio = dpr;
	const { Office } = await import('./office');
	const o: any = new Office(fakeCanvas() as any, { clientWidth: w, clientHeight: h } as any, input);
	if (view) o.setView(view);
	return o;
}

describe('zoom', () => {
	for (const dpr of [1, 1.5, 2]) {
		it(`anchor stays under cursor, crisp, clamped (dpr ${dpr})`, async () => {
			const o = await mk(900, 680, dpr);
			const S1 = o.S;
			expect(o.movable).toBe(false);
			const cx = 400, cy = 300;
			for (let i = 0; i < 30; i++) {
				const ax = (cx - o.TX) / o.S, ay = (cy - o.TY) / o.S;
				o.zoomAt(1.13, cx, cy);
				// clamp ensures may deviate at edges; here cursor is central
				expect(Math.abs(o.TX + ax * o.S - cx)).toBeLessThan(1);
				expect(Math.abs(o.TY + ay * o.S - cy)).toBeLessThan(1);
				expect(Math.abs(o.S * dpr - Math.round(o.S * dpr))).toBeLessThan(1e-9);
				expect(Math.abs(o.TX * dpr - Math.round(o.TX * dpr))).toBeLessThan(1e-9);
				if (358 * o.S > 900) {
					expect(o.TX).toBeLessThanOrEqual(0);
					expect(o.TX + 358 * o.S).toBeGreaterThanOrEqual(900 - 1e-9);
				} else expect(Math.abs(o.TX - (900 - 358 * o.S) / 2)).toBeLessThanOrEqual(0.5);
			}
			expect(o.zoom).toBe(3);
			expect(o.S).toBeLessThanOrEqual(3 * Math.min(900 / 358, 680 / 270));
			expect(o.movable).toBe(true);
			o.panBy(-10000, -10000);
			expect(o.TX).toBeCloseTo(900 - 358 * o.S, 6);
			expect(o.TY).toBeCloseTo(680 - 270 * o.S, 6);
			o.panBy(10000, 10000);
			expect(o.TX).toBe(0);
			expect(o.TY).toBe(0);
			for (let i = 0; i < 40; i++) o.zoomAt(0.8, 10, 10);
			expect(o.zoom).toBe(1);
			expect(o.S).toBe(S1);
			expect(o.movable).toBe(false);
			expect(o.resetView()).toBe(false);
			o.zoomAt(2, 100, 100);
			expect(o.resetView()).toBe(true);
			expect(o.S).toBe(S1);
		});
	}
	it('hit() follows zoom', async () => {
		const o = await mk(900, 680, 2);
		const p = o.anchor('strategist');
		// a point on the strategist body: below the anchor
		const bx = p.x, by = p.y + 20 * o.S;
		expect(o.hit(bx, by)).toBe('strategist');
		o.zoomAt(2.5, bx, by);
		expect(o.hit(bx, by)).toBe('strategist');
		const q = o.anchor('strategist');
		expect(o.hit(q.x, q.y + 20 * o.S)).toBe('strategist');
	});
	it('mobile fill: min = default fill scale, reserve change keeps zoom, fill toggle resets', async () => {
		const o = await mk(390, 700, 2, { reserve: 300, fill: true });
		const S1 = o.S;
		o.zoomAt(0.5, 100, 100);
		expect(o.S).toBe(S1);
		o.zoomAt(2, 100, 100);
		const S2 = o.S;
		expect(S2).toBeGreaterThan(S1);
		o.setView({ reserve: 200 });
		expect(o.zoom).toBe(2);
		o.setView({ fill: false });
		expect(o.zoom).toBe(1);
		expect(o.pan).toEqual({ x: 0, y: 0 });
	});
});
