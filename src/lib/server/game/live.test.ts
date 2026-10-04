import { describe, expect, it } from 'vitest';
import { AnthropicModel } from '../model/anthropic';
import { CLIENT_CARD, GPT_CARD, systemFor } from './characters';
import { SCHEMA, guide, normClient, normContent, normGpt, normLogo, normNaming, normPositioning, normRead, normReview, parseJson, request } from './steps';
import { CORE } from '$lib/types';

// Живі перевірки коштують грошей: лише з LIVE_CLAUDE=1 і ключем.
const key = process.env.LIVE_CLAUDE ? process.env.ANTHROPIC_API_KEY : undefined;
const m = key ? new AnthropicModel(key) : null;
const brief = 'Клієнт: Олег, СТО на Троєщині. Бриф: «Дружина каже треба бренд. Ремонтуємо машини 15 років. Тільки щоб номер телефону великий.»';
const go = async (model: string, system: string, schema: Record<string, unknown>, user0: string) => { const user = user0 + guide(schema);
	const r = await m!.call(request({ model, system, messages: [{ role: 'user', content: user }], schema }), { purpose: 'read', who: 'live', fake: () => ({}) });
	expect(r.stopReason).not.toBe('max_tokens');
	return parseJson(r.text);
};

describe.skipIf(!key)('справжній Claude: формат запитів', () => {
	it('read на sonnet', async () => { const o = normRead(await go('claude-sonnet-5-5', systemFor('strategist', 10), SCHEMA.read, brief + '\nРозбери бриф.')); console.log('READ', o.thought); expect(o.observations.length).toBeGreaterThan(0); }, 120000);
	it('review на opus', async () => { const o = normReview(await go('claude-opus-5-5', systemFor('copywriter', 10), SCHEMA.review, brief + '\nКолеги: Стратегиня (strategist): - клієнт не знає кому продає\nДизайнер (designer): - усі СТО червоні\nНазви найслабше місце з цитатою.'), 'copywriter'); console.log('REVIEW', o.thought, '|', o.weakest.quote); expect(o.weakest.quote).toBeTruthy(); }, 180000);
	it('positioning', async () => { const o = normPositioning(await go('claude-sonnet-5-5', systemFor('strategist', 10), SCHEMA.positioning, brief + '\nСформулюй позиціонування, 3 кандидати.')); console.log('POS', o.positioning, '|', o.role, '|', o.enemy); }, 120000);
	it('naming', async () => { const o = normNaming(await go('claude-sonnet-5-5', systemFor('copywriter', 10), SCHEMA.naming, 'Позиціонування: «Чесний ремонт без понтів». Роль: майстер. Ворог: розводилово. Назва і слоган.')); console.log('NAME', o.name.text, '|', o.slogan.text); }, 120000);
	it('logo', async () => { const o = normLogo(await go('claude-sonnet-5-5', systemFor('designer', 10), SCHEMA.logo, 'Позиціонування: «Чесний ремонт без понтів». Намалюй знак.')); console.log('LOGO', o.concept, o.logo.shapes.length); }, 120000);
	it('content youtube', async () => { const o = normContent('youtube', await go('claude-sonnet-5-5', systemFor('strategist', 10), SCHEMA.youtube, 'Назва «Без понтів». Придумай іміджевий ролик.')); console.log('YT', o.text); }, 120000);
	it('gpt на haiku', async () => { const o = normGpt(await go('claude-haiku-4-5', GPT_CARD, SCHEMA.gpt, 'Копірайтер питає: кліше СТО? Уривків нема.')); console.log('GPT', o.answer.slice(0, 80)); }, 120000);
	it('client', async () => { const o = normClient(await go('claude-sonnet-5-5', CLIENT_CARD.replace('{archetype}', 'недовірливий'), SCHEMA.client, 'Агенція показує: Назва: Без понтів. Слоган: Ремонт, за який не соромно.'), CORE, 1); console.log('CLIENT', o.verdict, o.mood, o.reaction); }, 120000);
});
