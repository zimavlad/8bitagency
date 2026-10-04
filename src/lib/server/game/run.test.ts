import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeModel } from '../model/fake';
import { inboxFor } from './briefs';
import { Game } from './game';
import { Run } from './run';

const MODELS = { agent: 'claude-sonnet-5-5', review: 'claude-opus-5-5', client: 'claude-sonnet-5-5', gpt: 'claude-haiku-4-5' };
const tick = () => new Promise((r) => setTimeout(r, 0));
async function until(f: () => boolean, ms = 3000) {
	const t = Date.now();
	while (!f()) {
		if (Date.now() - t > ms) throw new Error('timeout');
		await tick();
	}
}
const brief = inboxFor(1, 40)[0];
const mk = (model = new FakeModel()) => {
	const run = new Run('t1', brief, { model, models: MODELS, dataDir: mkdtempSync(join(tmpdir(), 'run-')), burnout: { strategist: 0, copywriter: 0, designer: 0 } });
	return { run, model };
};
const text = (p: unknown) => JSON.stringify(p);

describe('бриф від початку до оплати', () => {
	it('повний цикл: раунди, правка гравця, клієнт з правками, контент, оплата', async () => {
		const { run } = mk();
		run.start();
		await until(() => run.state.phase === 'player_core');
		expect(Object.keys(run.state.elements).sort()).toEqual(['logo', 'name', 'positioning', 'slogan']);
		expect(run.state.elements.logo?.logo?.shapes.length).toBeGreaterThan(0);

		expect(await run.edit('slogan', 'сміливіше')).toBeNull();
		expect(run.state.elements.slogan?.edited).toBe(true);
		expect(await run.edit('slogan', 'ще раз')).toMatch(/уже використано/);
		expect(run.submit()).toBeNull();

		await until(() => run.state.phase === 'player_content');
		expect(run.state.verdicts.filter((v) => v.stage === 'core').map((v) => v.verdict)).toEqual(['rework', 'ok']);
		expect(run.state.elements.logo?.clientReworks).toBe(1);
		expect(Object.keys(run.state.elements)).toEqual(expect.arrayContaining(['threads', 'instagram', 'reels', 'youtube']));
		run.submit();

		await until(() => run.state.phase === 'done');
		expect(run.state.result?.verdict).toBe('ok');
		expect(run.state.result?.paid).toBeGreaterThan(0);
		expect(run.state.result?.burnoutDelta.copywriter).toBeGreaterThan(0);
	});

	it('сліпота: у першому раунді ніхто не бачить колег; у ревʼю — рівно двох інших; копірайтер не бачить дизайнера', async () => {
		const { run, model } = mk();
		run.start();
		await until(() => run.state.phase === 'player_core');
		const reads = model.requests.filter((r) => r.purpose === 'read');
		expect(reads).toHaveLength(3);
		for (const r of reads) {
			expect(r.params.messages).toHaveLength(1);
			expect(text(r.params.messages)).not.toMatch(/Колеги прочитали|Здогадка:/);
		}
		for (const r of model.requests.filter((r) => r.purpose === 'review')) {
			expect(r.params.model).toBe('claude-opus-5-5');
			const others = ['Стратегиня (strategist)', 'Копірайтер (copywriter)', 'Дизайнер (designer)'].filter((s) => text(r.params.messages).includes(s));
			expect(others).toHaveLength(2);
			expect(text(r.params.messages)).not.toContain(`(${r.who})`);
		}
		const naming = model.requests.find((r) => r.purpose === 'core' && r.who === 'copywriter')!;
		expect(text(naming.params.messages)).toContain(run.state.elements.positioning!.text.slice(0, 20));
		expect(text(naming.params.messages)).not.toMatch(/shapes|concept/);
		expect(naming.params.model).toBe('claude-sonnet-5-5');
	});

	it('історія агента тільки дописується', async () => {
		const { run, model } = mk();
		run.start();
		await until(() => run.state.phase === 'player_core');
		const own = model.requests.filter((r) => r.who === 'strategist' && r.purpose !== 'review');
		for (let i = 1; i < own.length; i++) expect(text(own[i].params.messages)).toContain(text(own[i - 1].params.messages).slice(1, -1));
	});

	it('кинутий бриф: далі нічого не пишеться', async () => {
		const { run, model } = mk(new FakeModel({ delayMs: [5, 10] }));
		run.start();
		await until(() => model.requests.length >= 1);
		run.drop();
		const log = run.state.log.length;
		const calls = model.requests.length;
		await new Promise((r) => setTimeout(r, 80));
		expect(run.state.phase).toBe('done');
		expect(run.state.result?.verdict).toBe('dropped');
		expect(run.state.log.length).toBe(log);
		expect(model.requests.length).toBe(calls);
	});
});

describe('гра', () => {
	it('після брифу — новий день, гроші, вигорання, історія', async () => {
		const g = new Game({ dataDir: mkdtempSync(join(tmpdir(), 'game-')), model: new FakeModel(), models: MODELS });
		const money = g.state.money;
		const { run } = g.start({ briefId: g.state.inbox[0].id });
		expect(g.start({ briefId: g.state.inbox[0]?.id }).error).toMatch(/закінчи/);
		await until(() => run!.state.phase === 'player_core');
		run!.submit();
		await until(() => run!.state.phase === 'player_content');
		run!.submit();
		await until(() => run!.state.phase === 'done' && g.state.activeRun === null);
		expect(g.state.day).toBe(2);
		expect(g.state.money).toBe(money + run!.state.result!.paid - 6000);
		expect(g.state.history).toHaveLength(1);
		expect(g.state.inbox).toHaveLength(3);
		expect(g.rest()).toBeNull();
		expect(g.state.day).toBe(3);
	});

	it('свій бриф: замалий відхиляється', () => {
		const g = new Game({ dataDir: mkdtempSync(join(tmpdir(), 'game-')), model: new FakeModel(), models: MODELS });
		expect(g.start({ custom: { text: 'лого', business: '' } }).error).toMatch(/закороткий/);
	});
});
