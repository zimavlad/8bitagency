/**
 * Вибір правок клієнта: гравець відмічає, що команда візьме в роботу.
 * Щоб клієнт подобрішав, треба взяти щонайменше половину (не менше трьох, якщо стільки є)
 * і хоча б одну «кринжову» — ту, що вбиває ідею. Котра з них кринжова, знає лише гра.
 */
export function needOf(n: number): number {
	return Math.min(n, Math.max(3, Math.ceil(n / 2)));
}

export function pickMood(base: number, n: number, picks: number[], cringe: number[] = []): { mood: number; ok: boolean } {
	const k = new Set(picks.filter((i) => i >= 0 && i < n)).size;
	const hit = picks.some((i) => cringe.includes(i));
	const ok = k >= needOf(n) && (hit || !cringe.length);
	const raw = base + k * 6 + (hit ? 10 : 0);
	return { mood: Math.round(ok ? Math.min(95, Math.max(65, raw)) : Math.max(5, Math.min(55, raw))), ok };
}
