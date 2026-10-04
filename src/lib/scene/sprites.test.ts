import { describe, expect, it } from 'vitest';
import { BODY, LEGS, PALETTE, type SpriteId } from './sprites';

describe('спрайти', () => {
	it.each(Object.keys(BODY) as SpriteId[])('%s: 12×18 і кожна літера має колір', (id) => {
		const frames = LEGS[id].map((legs) => [...BODY[id], ...legs]);
		for (const rows of frames) {
			expect(rows).toHaveLength(18);
			for (const r of rows) {
				expect(r).toHaveLength(12);
				for (const ch of r) if (ch !== '.') expect(PALETTE[id][ch], `${id}: «${ch}»`).toBeTruthy();
			}
		}
	});
});
