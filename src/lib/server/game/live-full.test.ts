import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { AnthropicModel } from '../model/anthropic';
import { FakeImages, GeminiImages } from '../model/images';
import { inboxFor } from './briefs';
import { Run } from './run';
const OUT = join(tmpdir(), 'agency-live-full.json');
it.skipIf(!(process.env.LIVE_CLAUDE && process.env.ANTHROPIC_API_KEY))('повний бриф на справжньому Claude', async () => {
	const t0 = Date.now();
	const brief = inboxFor(1, 40).find((b) => b.client.name === 'Олег') ?? inboxFor(1, 40)[0];
	const run = new Run('live1', brief, { model: new AnthropicModel(process.env.ANTHROPIC_API_KEY!), images: process.env.GEMINI_API_KEY ? new GeminiImages(process.env.GEMINI_API_KEY) : new FakeImages(), models: { agent: 'claude-sonnet-5-5', review: 'claude-opus-5-5', client: 'claude-sonnet-5-5', gpt: 'claude-haiku-4-5' }, dataDir: mkdtempSync(join(tmpdir(), 'live-')), burnout: { strategist: 10, copywriter: 15, designer: 5 } });
	run.start();
	const wait = async (f: () => boolean) => { while (!f()) { if (run.state.phase === 'failed') throw new Error(run.state.error ?? 'failed'); await new Promise((r) => setTimeout(r, 300)); } };
	await wait(() => run.state.phase === 'pick_name');
	run.decide({ action: 'pick', index: 0 });
	await wait(() => run.state.phase === 'player_core');
	const tCore = Date.now() - t0;
	expect(run.decide({ action: 'edit', notes: ['слоган сміливіше', '', 'щоб зрозумів пенсіонер'] })).toBeNull();
	await wait(() => run.state.phase === 'player_core');
	run.decide({ action: 'submit' });
	// клієнт: щоразу пробуємо ще коло, поки не скаже так або ні
	for (;;) {
		await wait(() => ['client_decision_core', 'client_decision_content', 'player_content', 'done'].includes(run.state.phase));
		const p = run.state.phase;
		if (p === 'done') break;
		if (p === 'player_content') run.decide({ action: 'submit' });
		else run.decide({ action: 'retry' });
		await new Promise((r) => setTimeout(r, 300));
	}
	writeFileSync(OUT, JSON.stringify({ ms: Date.now() - t0, coreMs: tCore, calls: run.state.calls, usd: run.state.costUsd, imagesUsd: run.state.imagesUsd, result: run.state.result, verdicts: run.state.verdicts, elements: run.state.elements, log: run.state.log, trace: run.trace }, null, 1));
}, 900000);
