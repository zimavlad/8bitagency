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
