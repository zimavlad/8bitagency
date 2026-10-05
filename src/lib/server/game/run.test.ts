import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeModel } from '../model/fake';
import { FakeImages } from '../model/images';
import { inboxFor } from './briefs';
import { resetLedgerCache } from '../ledger';
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
	const run = new Run('rtest1', brief, { model, images, models: MODELS, dataDir, burnout: { strategist: 0, copywriter: 0, designer: 0 }, morale: { strategist: 70, copywriter: 70, designer: 70 } });
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
		// не подобається — ще варіанти
		const first = run.state.options.map((o) => o.name).join();
		expect(run.decide({ action: 'more' })).toBeNull();
		await until(() => run.state.phase === 'pick_name' && run.state.rerolls === 1);
		expect(run.state.steps.find((x) => x.key === 'name')?.lines[0]).toMatch(/Забраковано/);
		void first;
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
		expect(run.decide({ action: 'continue' })).toMatch(/ще коло/);
		expect(run.decide({ action: 'retry' })).toBeNull();
		// після переробки під клієнта — знову зведення гравцю
		await until(() => run.state.phase === 'player_core');
		expect(run.state.changed.length).toBeGreaterThan(0);
		run.decide({ action: 'submit' });
		await until(() => run.state.phase === 'client_decision_core' && run.state.verdicts.length === 2);
		// за сценарієм: два кола правок, на третьому клієнт у захваті
		expect(run.state.verdicts.at(-1)?.verdict).toBe('rework');
		run.decide({ action: 'retry' });
		await until(() => run.state.phase === 'player_core');
		run.decide({ action: 'submit' });
		await until(() => run.state.phase === 'client_decision_core' && run.state.verdicts.length === 3);
		// після «так» гра чекає гравця: спершу репліки клієнта й поп-ап, потім комунікація
		expect(run.state.verdicts.at(-1)?.lines.length).toBeGreaterThan(0);
		expect(run.decide({ action: 'retry' })).toMatch(/далі/);
		expect(run.decide({ action: 'continue' })).toBeNull();
		await until(() => run.state.phase === 'player_content');
		expect(run.state.verdicts.filter((v) => v.stage === 'core').map((v) => v.verdict)).toEqual(['rework', 'rework', 'ok']);
		// канали коротко, банер і розкадровка намальовані
		expect(Object.keys(run.state.elements)).toEqual(expect.arrayContaining(['threads', 'instagram', 'reels', 'youtube']));
		expect(run.state.elements.instagram?.image).toMatch(/^\/api\/images\/rtest1\/instagram-/);
		expect(run.state.elements.youtube?.image).toMatch(/youtube-/);
		expect(images.prompts.find((p) => p.includes('storyboard'))).toBeTruthy();
		// кожен етап можна переглянути: варіанти назви, знак, кола клієнта
		expect(run.state.steps.find((x) => x.key === 'name')?.lines).toHaveLength(6);
		expect(run.state.steps.find((x) => x.key === 'logo')?.logos?.length).toBeGreaterThan(1);
		expect(run.state.strategy?.insight).toBeTruthy();
		expect(images.prompts[0]).toContain('Stardew Valley');
		expect(readdirSync(join(dataDir, 'images', 'rtest1'))).toHaveLength(2);

		run.decide({ action: 'submit' });
		await until(() => run.state.phase === 'client_decision_content');
		run.decide({ action: 'retry' });
		await until(() => run.state.phase === 'player_content');
		run.decide({ action: 'submit' });
		await until(() => run.state.phase === 'client_decision_content' && run.state.verdicts.length === 5);
		expect(run.state.verdicts.filter((v) => v.stage === 'content').map((v) => v.verdict)).toEqual(['rework', 'ok']);
		run.decide({ action: 'continue' });
		await until(() => run.state.phase === 'done');
		expect(run.state.result?.verdict).toBe('ok');
		// чек повністю: 20% передплата на старті і 80% — коли клієнт прийняв усе
		expect(run.state.result?.paid).toBe(brief.fee);
		expect(run.state.result?.pay.map((p) => p.amount)).toEqual([brief.prepay, brief.fee - brief.prepay]);
		expect(brief.prepay).toBe(brief.fee * 0.2);
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

	it('порожній знак: дизайнер перемальовує один раз', async () => {
		let n = 0;
		const model = new FakeModel();
		const { run } = mk(model);
		const orig = model.call.bind(model);
		model.call = (p, o) => orig(p, o.purpose === 'core' && o.who.endsWith('designer') && n++ === 0 ? { ...o, fake: () => ({ thought: '', concept: 'x', palette: { a: '#000000', b: '#ffffff' }, shapes: [{ type: 'circle', cx: 50, cy: 50, r: 0, fill: 'a' }] }) } : o);
		run.start();
		await until(() => run.state.phase === 'pick_name');
		run.decide({ action: 'pick', index: 0 });
		await until(() => run.state.phase === 'player_core');
		expect(run.state.elements.logo?.logo?.shapes.length).toBeGreaterThan(1);
	});

	it('кинути проєкт після правок клієнта: лишається тільки передплата', async () => {
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
		expect(run.state.result?.paid).toBe(brief.prepay);
		expect(run.state.result?.pay[1]).toMatchObject({ amount: 0 });
		expect(run.state.agents.strategist.morale).toBeLessThan(70);
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
	const mkGame = () => (resetLedgerCache(mkdtempSync(join(tmpdir(), 'ledger-'))), new Game({ dataDir: mkdtempSync(join(tmpdir(), 'game-')), model: new FakeModel(), images: new FakeImages(), models: MODELS }));

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
		await until(() => run!.state.phase === 'player_core');
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_decision_core' && run!.state.verdicts.length === 2);
		run!.decide({ action: 'retry' });
		await until(() => run!.state.phase === 'player_core');
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_decision_core' && run!.state.verdicts.length === 3);
		run!.decide({ action: 'continue' });
		await until(() => run!.state.phase === 'player_content');
		expect(g.perk('pizza').error).toBeUndefined();
		expect(g.perk('pizza').error).toMatch(/вже/);
		// кава без ліміту: мораль +1 і стрес +1
		const st = run!.state.agents.copywriter.burnout;
		g.perk('coffee');
		g.perk('coffee');
		expect(run!.state.agents.copywriter.burnout).toBe(st + 2);
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_decision_content');
		run!.decide({ action: 'retry' });
		await until(() => run!.state.phase === 'player_content');
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_decision_content' && run!.state.verdicts.length === 5);
		expect(g.state.history).toHaveLength(0);
		run!.decide({ action: 'continue' });
		await until(() => run!.state.phase === 'done' && g.state.activeRun === null);
		expect(g.state.day).toBe(2);
		// гроші: увесь чек (передплата прийшла на старті) мінус день (оренда 600 + 3 зарплати по 300) і піца
		expect(g.state.money).toBe(money + run!.state.result!.paid - 1500 - 400);
		expect(g.state.inbox.every((b) => b.tier === 1 && b.fee <= 5000 && b.prepay === b.fee * 0.2)).toBe(true);
		expect(g.state.team.strategist.done).toBe(1);
		expect(g.state.history).toHaveLength(1);
		expect(g.state.history[0].case?.name).toBeTruthy();
		// рахунки API спільні на сервер, у грі — лише вигляд
		expect(g.setBalance('gemini', 4.5)).toBeNull();
		expect(g.view().ledger.gemini).toMatchObject({ usd: 4.5, spent: 0 });
	});

	it('похвала при стресі понад 60% лише дратує; після 5 проєктів — прохання про підвищення', () => {
		const g = mkGame();
		g.state.burnout.designer = 70;
		const m = g.state.morale.designer;
		expect(g.perk('praise', 'designer').note).toMatch(/не зайшла/);
		expect(g.state.morale.designer).toBe(m - 4);
		expect(g.perk('praise', 'strategist').note).toMatch(/зайшла/);
		g.state.ask = 'copywriter';
		expect(g.answer(false)).toBeNull();
		expect(g.state.team.copywriter.sulk).toBe(true);
		g.rest();
		expect(g.state.team.copywriter.sulk).toBe(false);
	});

	it('свій бриф: клієнт — гравець, лисий; правки текстом до 3 кіл, потім «беру»', async () => {
		const g = mkGame();
		const { run } = g.start({ custom: { business: 'Креативна агенція 8bit', goals: 'більше клієнтів', wishes: 'з гумором', competitors: 'всі', usp: 'піксель' } });
		await until(() => run!.state.phase === 'pick_name');
		expect(run!.state.brief.client.name).toBe('Ти');
		run!.decide({ action: 'pick', index: 0 });
		await until(() => run!.state.phase === 'player_core');
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_core');
		expect(run!.decide({ action: 'feedback', notes: [''] })).toMatch(/хоча б одну/);
		expect(run!.decide({ action: 'feedback', notes: ['більше гумору'] })).toBeNull();
		await until(() => run!.state.phase === 'player_core');
		expect(run!.state.speech.some((x) => x.who === 'client' && x.text === 'більше гумору')).toBe(true);
		run!.decide({ action: 'submit' });
		await until(() => run!.state.phase === 'client_core');
		expect(run!.decide({ action: 'continue' })).toBeNull();
		await until(() => run!.state.phase === 'player_content');
	});

	it('інвестор: на восьмий ранок не в плюсі — гру закінчено', () => {
		const g = mkGame();
		for (let i = 0; i < 7; i++) g.rest();
		expect(g.state.day).toBe(8);
		expect(g.state.over).toBe('investor');
		expect(g.state.bankrupt).toBe(true);
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
