import { describe, expect, it } from 'vitest';
import { BODY, LEGS, PALETTE, SPRITE_H, SPRITE_W, type SpriteId } from './sprites';

describe('спрайти', () => {
	it.each(Object.keys(BODY) as SpriteId[])('%s: 16×32, кожна літера має колір, є обводка', (id) => {
		expect(PALETTE[id].outline).toBeTruthy();
		for (const legs of LEGS[id]) {
			const rows = [...BODY[id], ...legs];
			expect(rows).toHaveLength(SPRITE_H);
			for (const [i, r] of rows.entries()) {
				expect(r, `${id} рядок ${i}`).toHaveLength(SPRITE_W);
				for (const ch of r) if (ch !== '.') expect(PALETTE[id][ch], `${id}: «${ch}»`).toBeTruthy();
			}
		}
	});
});

import { clientSprite } from './sprites';

describe('клієнти', () => {
	it.each([['m', 'suit'], ['f', 'creative'], ['f', 'sport'], ['m', 'farmer']] as const)('%s/%s: 16×32 і всі кольори є', (g, look) => {
		const c = clientSprite(g, look);
		for (const legs of c.legs) {
			const rows = [...c.body, ...legs];
			expect(rows).toHaveLength(32);
			for (const r of rows) {
				expect(r).toHaveLength(16);
				for (const ch of r) if (ch !== '.') expect((c.pal as Record<string, string>)[ch], `«${ch}»`).toBeTruthy();
			}
		}
	});
});
