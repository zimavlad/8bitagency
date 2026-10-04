import { describe, expect, it } from 'vitest';
import type { ElementValue } from '$lib/types';
import { qualityOf, quoteFound, reputationDelta } from './checks';

const el = (id: ElementValue['id'], text: string, details: string[] = []): ElementValue => ({ id, text, details, edited: false, approved: false, clientReworks: 0 });

describe('перевірки', () => {
	it('чиста робота дає високу якість', () => {
		const { quality } = qualityOf([el('positioning', 'Для тих, хто втомився від показухи.'), el('slogan', 'Робимо як для себе'), el('name', 'Без понтів')]);
		expect(quality).toBeGreaterThanOrEqual(90);
	});

	it.each([
		['slogan', 'Найкраща якість для вас!'],
		['instagram', 'Знижка -20% тільки сьогодні'],
		['name', 'Дуже Довга Назва Що Не Влазить']
	] as const)('ловить погане: %s «%s»', (id, text) => {
		expect(qualityOf([el(id, text)]).quality).toBeLessThan(100);
	});

	it('перфоманс-штампи рахуються окремо', () => {
		expect(qualityOf([el('instagram', 'Купуй зараз', ['Підпис: знижка 30%'])]).performanceHits).toBe(1);
	});

	it('репутація: відмова тупого клієнта при чесній роботі не топить', () => {
		expect(reputationDelta(100, 'reject')).toBeGreaterThanOrEqual(0);
		expect(reputationDelta(30, 'ok')).toBeLessThan(0);
	});

	it('цитата шукається дослівно', () => {
		expect(quoteFound('«Клієнт сам не знає»', '- клієнт сам не знає, кому продає')).toBe(true);
		expect(quoteFound('вигадана цитата', '- клієнт сам не знає')).toBe(false);
	});
});
