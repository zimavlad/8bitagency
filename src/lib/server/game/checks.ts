import type { ElementId, ElementValue } from '$lib/types';

/**
 * Перевірки якості кодом. Модель сама себе не оцінює: репутацію в індустрії рахує тільки цей файл.
 * Конфлікт гри: клієнт платить за «тупий перфоманс», а репутація падає саме від нього.
 */

const JUNK = ['якість', 'якісн', 'інновац', 'найкращ', 'для вас', 'разом з вами', 'надійн', 'зручн', 'унікальн', 'турбот', 'кращий вибір', 'ми цінуємо', 'лідер ринку'];
const PERFORMANCE = ['знижк', '%', 'акці', 'дзвоніть', 'купуй', 'безкоштовн', 'тільки сьогодні', 'встигни', 'розпродаж', 'хіт продаж', 'супер ціна', 'вигідн'];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const has = (s: string, list: string[]) => list.filter((w) => s.toLowerCase().includes(w));

export interface CheckNote {
	element: ElementId;
	ok: boolean;
	text: string;
}

export function checkElement(e: ElementValue): CheckNote[] {
	const notes: CheckNote[] = [];
	const t = e.text;
	const all = [t, ...e.details].join(' ');
	const junk = has(t, JUNK);
	if (junk.length) notes.push({ element: e.id, ok: false, text: `загальники: ${junk.join(', ')}` });
	const perf = has(all, PERFORMANCE);
	if (perf.length) notes.push({ element: e.id, ok: false, text: `перфоманс-штампи: ${perf.join(', ')}` });

	switch (e.id) {
		case 'positioning':
			if (words(t).length > 30) notes.push({ element: e.id, ok: false, text: 'позиціонування довше за 30 слів' });
			if ((t.match(/[.!?](\s|$)/g) ?? []).length > 1) notes.push({ element: e.id, ok: false, text: 'позиціонування — не одне речення' });
			break;
		case 'name':
			if (words(t).length > 3) notes.push({ element: e.id, ok: false, text: 'назва довша за 3 слова' });
			break;
		case 'slogan':
			if (words(t).length > 7) notes.push({ element: e.id, ok: false, text: 'слоган довший за 7 слів' });
			if (t.includes('!')) notes.push({ element: e.id, ok: false, text: 'знак оклику в слогані' });
			break;
		case 'logo':
			if (!e.logo) notes.push({ element: e.id, ok: false, text: 'знак не намальовано' });
			else if (e.logo.shapes.length > 6) notes.push({ element: e.id, ok: false, text: 'знак перевантажений фігурами' });
			break;
	}
	if (/[A-ZА-ЯІЇЄҐ]{5,}/u.test(t)) notes.push({ element: e.id, ok: false, text: 'капс' });
	if (!notes.length) notes.push({ element: e.id, ok: true, text: 'чисто' });
	return notes;
}

/** Якість 0..100: стартує зі 100, мінус за кожне порушення; перфоманс-штампи коштують найдорожче. */
export function qualityOf(elements: ElementValue[]): { quality: number; notes: CheckNote[]; performanceHits: number } {
	const notes = elements.flatMap(checkElement);
	let q = 100;
	let performanceHits = 0;
	for (const n of notes) {
		if (n.ok) continue;
		if (n.text.startsWith('перфоманс')) {
			q -= 12;
			performanceHits++;
		} else q -= 7;
	}
	return { quality: Math.max(0, Math.min(100, q)), notes, performanceHits };
}

/** Зміна репутації після брифу. Відмова клієнта при чесній роботі репутацію не топить. */
export function reputationDelta(quality: number, verdict: 'ok' | 'reject' | 'dropped'): number {
	if (verdict === 'dropped') return -3;
	const base = Math.round((quality - 60) / 8);
	return verdict === 'ok' ? base + 1 : Math.min(base, 1) - 1;
}

/** Цитата з рецензії має бути в тексті колеги дослівно (після нормалізації пробілів і лапок). */
export function quoteFound(quote: string, source: string): boolean {
	const norm = (s: string) => s.toLowerCase().replace(/[«»"“”„’ʼ']/g, '').replace(/\s+/g, ' ').trim();
	const q = norm(quote);
	return q.length >= 4 && norm(source).includes(q);
}
