import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexFor, search } from './kb';

describe('база знань Джіпітенка', () => {
	it('знаходить потрібний шматок у файлі своєї ролі', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'kb-'));
		mkdirSync(join(dir, 'knowledge', 'copywriter'), { recursive: true });
		writeFileSync(join(dir, 'knowledge', 'copywriter', 'slogans.md'), 'Слоган має бути коротким. '.repeat(10) + ' Про піцерії: усі пишуть «смачно і швидко», це кліше піцерій. '.repeat(5));
		writeFileSync(join(dir, 'knowledge', 'copywriter', 'other.txt'), 'Про автосервіси й ремонт двигунів, мастила і шини. '.repeat(20));
		const idx = await indexFor(dir, 'copywriter');
		const hit = search(idx, 'кліше для піцерії', 1);
		expect(hit[0]?.source).toBe('slogans.md');
		expect((await indexFor(dir, 'strategist')).chunks).toHaveLength(0);
	});
});
