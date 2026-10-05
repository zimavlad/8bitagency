import { describe, expect, it } from 'vitest';
import { sceneOnly } from './run';
import type { ElementValue } from '$lib/types';
import { qualityOf, quoteFound, reputationDelta } from './checks';

const el = (id: ElementValue['id'], text: string, details: string[] = []): ElementValue => ({ id, text, details, reworks: 0 });

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

describe('розкадровка', () => {
	it('з опису сцени прибираються цитати, телефони, відсотки й «акції»', () => {
		expect(sceneOnly('Великі цифри телефону 067-123-45-67 на пів кадру, АКЦІЯ −20% і золотий будиночок.')).toBe('Великі цифри на пів кадру, і золотий будиночок.');
		expect(sceneOnly('Напис: «Борщ щодня»')).toBe('a sign');
		expect(sceneOnly('Вечір: у вікні лампи')).toBe('у вікні лампи');
	});
});

import { geminiUsd } from '../model/images';
import { costUsd } from '../pricing';

describe('лічильник грошей', () => {
	it('Gemini: ціна з токенів відповіді (картинка 60$/М, решта виходу 3$/М, вхід 0,5$/М)', () => {
		const u = { promptTokenCount: 459, candidatesTokenCount: 1616, candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }] };
		expect(geminiUsd(u)).toBeCloseTo((459 * 0.5 + 1120 * 60 + 496 * 3) / 1e6, 6);
	});
	it('Claude: невідома резервна модель не рахується нулем', () => {
		const u = { input_tokens: 1000, output_tokens: 1000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
		expect(costUsd('claude-sonnet-5-5', u)).toBeCloseTo(0.012, 6);
		expect(costUsd('claude-mystery-9', u)).toBeGreaterThan(0);
	});
});
