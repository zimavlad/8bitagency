import { describe, expect, it } from 'vitest';
import { needOf, pickMood } from './picks';

describe('вибір правок', () => {
	it('скільки треба взяти', () => {
		expect([1, 2, 3, 5, 7].map(needOf)).toEqual([1, 2, 3, 3, 4]);
	});
	it('без кринжової клієнт не задоволений, навіть якщо взяти багато', () => {
		expect(pickMood(42, 6, [0, 1, 2, 3], [5]).ok).toBe(false);
		expect(pickMood(42, 6, [0, 1, 5], [5]).ok).toBe(true);
		expect(pickMood(42, 6, [0, 1, 5], [5]).mood).toBeGreaterThanOrEqual(65);
		expect(pickMood(42, 6, [0], [5]).mood).toBeLessThanOrEqual(55);
	});
});
