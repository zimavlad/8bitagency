import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeModel } from '../model/fake';
import { FakeImages } from '../model/images';
import { inboxFor } from './briefs';
import { Game } from './game';
import { Run } from './run';

const MODELS = { agent: 'claude-sonnet-5-5', review: 'claude-opus-5-5', client: 'claude-sonnet-5-5', gpt: 'claude-haiku-4-5' };
const tick = () => new Promise((r) => setTimeout(r, 0));
async function until(f: () => boolean, ms = 4000) {
	const t = Date.now();
	while (!f()) {
		if (Date.now() - t > ms) throw new Error('timeout');
		await tick();
	}
}
const brief = inboxFor(1, 40)[0];
const mk = (model = new FakeModel(), images = new FakeImages()) => {
	const dataDir = mkdtempSync(join(tmpdir(), 'run-'));
	const run = new Run('rtest1', brief, { model, images, models: MODELS, dataDir, burnout: { strategist: 0, copywriter: 0, designer: 0 } });
	return { run, model, images, dataDir };
};
const text = (p: unknown) => JSON.stringify(p);

describe('бриф від початку до оплати', () => {
	it('стратегиня перша, вибір назви, раунд правок, кола з клієнтом, канали з картинками, оплата', async () => {
		const { run, model, images, dataDir } = mk();
		run.start();
		await until(() => run.state.phase === 'pick_name');
		// до вибору назви працювали лише стратегиня (читання, позиціонування) і поради колег
		expect(model.requests.map((r) => r.purpose).filter((p) => p !== 'gpt')).toEqual(['read', 'review', 'review', 'core', 'core']);
		expect(run.state.options).toHaveLength(3);
		expect(run.decide({ action: 'pick', index: 5 })).toMatch(/Нема/);
		expect(run.decide({ action: 'pick', index: 1 })).toBeNull();
		await until(() => run.state.phase === 'player_core');
		expect(run.state.elements.name?.text).toBe('Свої');
		expect(run.state.elements.logo?.logo?.shapes.length).toBeGreaterThan(0);

		// один раунд до трьох правок; порожні поля пропускаються
		expect(run.decide({ action: 'edit', notes: ['', '  '] })).toMatch(/хоча б одну/);
		expect(run.decide({ action: 'edit', notes: ['сміливіше', '', 'про швидкість'] })).toBeNull();
		await until(() => model.requests.filter((r) => r.purpose === 'rework').length === 3 && run.state.phase === 'player_core');
		expect(run.state.editAvailable).toBe(false);
		expect(run.decide({ action: 'edit', notes: ['ще'] })).toMatch(/вже використано/);
		const reworks = model.requests.filter((r) => r.purpose === 'rework').map((r) => r.who.split(':')[1]);
		expect(reworks).toEqual(['strategist', 'copywriter', 'designer']);

		// клієнт хоче правок — гравець обирає ще коло
		expect(run.decide({ action: 'submit' })).toBeNull();
		await until(() => run.state.phase === 'client_decision_core');
		expect(run.state.verdicts.at(-1)?.verdict).toBe('rework');
		expect(run.decide({ action: 'retry' })).toBeNull();
		await until(() => run.state.phase === 'player_content');
		expect(run.state.verdicts.filter((v) => v.stage === 'core').map((v) => v.verdict)).toEqual(['rework', 'ok']);
		// канали коротко, банер і розкадровка намальовані
		expect(Object.keys(run.state.elements)).toEqual(expect.arrayContaining(['threads', 'instagram', 'reels', 'youtube']));
		expect(run.state.elements.instagram?.image).toMatch(/^\/api\/images\/rtest1\/instagram-/);
		expect(run.state.elements.youtube?.image).toMatch(/youtube-/);
		expect(images.prompts[0]).toContain('Stardew Valley');
		expect(readdirSync(join(dataDir, 'images', 'rtest1'))).toHaveLength(2);

		run.decide({ action: 'submit' });
		await until(() => run.state.phase === 'client_decision_content');
		run.decide({ action: 'retry' });
		await until(() => run.state.phase === 'done');
		expect(run.state.result?.verdict).toBe('ok');
		expect(run.state.result?.paid).toBeGreaterThan(0);
		expect(run.trace.length).toBe(model.requests.length + 4);
	});

	it('хто що бачить: колеги бачать лише розбір стратегині; копірайтер не бачить знака', async () => {
		const { run, model } = mk();
		run.start();
		await until(() => run.state.phase === 'pick_name');
		const reads = model.requests.filter((r) => r.purpose === 'read');
		expect(reads).toHaveLength(1);
		expect(reads[0].who).toMatch(/strategist$/);
		for (const r of model.requests.filter((r) => r.purpose === 'review')) {
			expect(r.params.model).toBe('claude-opus-5-5');
			expect(r.params.messages).toHaveLength(1);
			expect(text(r.params.messages)).toContain('Інсайт:');
		}
		const naming = model.requests.find((r) => r.purpose === 'core' && r.who.endsWith('copywriter'))!;
		expect(text(naming.params.messages)).toContain(run.state.elements.positioning!.text.slice(0, 20));
		expect(text(naming.params.messages)).not.toMatch(/shapes|palette/);
	});

	it('здатися: клієнт не заплатив, бриф закрито', async () => {
		const { run } = mk();
		run.start();
		await until(() => run.state.phase === 'pick_name');
		run.decide({ action: 'pick', index: 0 });
		await until(() => run.state.phase === 'player_core');
		run.decide({ action: 'submit' });
		await until(() => run.state.phase === 'client_decision_core');
		run.decide({ action: 'giveup' });
		await until(() => run.state.phase === 'done');
		expect(run.state.result?.verdict).toBe('reject');
		expect(run.state.result?.paid).toBe(0);
	});

	it('пауза зупиняє команду між кроками, продовження — відпускає', async () => {
		const { run, model } = mk(new FakeModel({ delayMs: [5, 10] }));
		run.setPaused(true);
		run.start();
		await new Promise((r) => setTimeout(r, 60));
		expect(model.requests).toHaveLength(0);
		run.setPaused(false);
		await until(() => run.state.phase === 'pick_name');
	});

	it('кинутий бриф: далі нічого не пишеться', async () => {
		const { run, model } = mk(new FakeModel({ delayMs: [5, 10] }));
		run.start();
		await until(() => model.requests.length >= 1);
		run.drop();
		const log = run.state.log.length;
		const calls = model.requests.length;
		await new Promise((r) => setTimeout(r, 80));
		expect(run.state.result?.verdict).toBe('dropped');
		expect(run.state.log.length).toBe(log);
		expect(model.requests.length).toBe(calls);
	});
});

describe('гра', () => {
	const mkGame = () => new Game({ dataDir: mkdtempSync(join(tmpdir(), 'game-')), model: new FakeModel(), images: new FakeImages(), models: MODELS });

	it('після брифу — новий день, гроші, архів, витрати в балансі', async () => {
		const g = mkGame();
		const money = g.state.money;
		const { run } = g.start({ briefId: g.state.inbox[0].id });
		await until(() => run!.state.phase === 'pick_name');
		run!.decide({ action: 'pick', index: 0 });
		await until(() => run!.state.phase === 'player_core');
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_decision_core');
		run!.decide({ action: 'retry' });
		await until(() => run!.state.phase === 'player_content');
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_decision_content');
		run!.decide({ action: 'retry' });
		await until(() => run!.state.phase === 'done' && g.state.activeRun === null);
		expect(g.state.day).toBe(2);
		expect(g.state.money).toBe(money + run!.state.result!.paid - 6000);
		expect(g.state.history).toHaveLength(1);
		expect(g.state.ledger.claude.usd).toBe(2.2);
		expect(g.setBalance('gemini', 4.5)).toBeNull();
		expect(g.state.ledger.gemini).toMatchObject({ usd: 4.5, spent: 0 });
	});

	it('свій бриф за полями: без бізнесу не стартує, клієнта уточнює персона', async () => {
		const g = mkGame();
		expect(g.start({ custom: { business: '', goals: 'x', wishes: '', competitors: '', usp: '' } }).error).toMatch(/бізнес/);
		const { run } = g.start({ custom: { business: 'Кавʼярня на Подолі', goals: 'більше гостей зранку', wishes: 'затишно', competitors: 'Aroma', usp: 'своя обсмажка' } });
		expect(run!.state.brief.text).toContain('Цілі: більше гостей зранку');
		await until(() => run!.state.brief.client.name !== 'Замовник');
		expect(run!.state.brief.client.look).toBe('leather');
	});
});
