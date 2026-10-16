import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'vitest';
import type { Brief } from '$lib/types';
import { AnthropicModel } from '../model/anthropic';
import { FakeImages, GeminiImages } from '../model/images';
import { inboxFor } from './briefs';
import { Run } from './run';
const OUT = process.env.DEMO_OUT ?? join(tmpdir(), 'agency-live-full.json');
/**
 * Повний бриф на справжньому Claude. Необовʼязково:
 * LIVE_CLIENT — імʼя клієнта з вхідних (як у прогоні гравця);
 * LIVE_CONTENT_EDIT — JSON-масив правок керівника до реклами (одне коло, як гравець у грі);
 * LIVE_CUSTOM — файл JSON {brief, feedback: [[правки кола 1], [кола 2]…]}: свій бриф, гравець-клієнт повертає з правками, потім «беру».
 */
it.skipIf(!(process.env.LIVE_CLAUDE && process.env.ANTHROPIC_API_KEY))('повний бриф на справжньому Claude', async () => {
	const t0 = Date.now();
	const custom = process.env.LIVE_CUSTOM ? (JSON.parse(readFileSync(process.env.LIVE_CUSTOM, 'utf8')) as { brief: Brief; feedback: string[][] }) : null;
	const want = process.env.LIVE_CLIENT ?? 'Людмила';
	let brief = custom?.brief ?? inboxFor(1, 15)[0];
	if (!custom) for (let d = 1; d < 60; d++) { const f = inboxFor(d, Number(process.env.LIVE_REP ?? 15)).find((b) => b.client.name === want); if (f) { brief = f; break; } }
	let contentEdit = process.env.LIVE_CONTENT_EDIT ? (JSON.parse(process.env.LIVE_CONTENT_EDIT) as string[]) : null;
	const feedback = [...(custom?.feedback ?? [])];
	const run = new Run('live1', brief, { model: new AnthropicModel(process.env.ANTHROPIC_API_KEY!), images: process.env.GEMINI_API_KEY ? new GeminiImages(process.env.GEMINI_API_KEY) : new FakeImages(), models: { agent: 'claude-sonnet-5-5', creative: 'claude-opus-5-5', review: 'claude-opus-5-5', client: 'claude-sonnet-5-5', gpt: 'claude-haiku-4-5' }, dataDir: process.env.DEMO_DATA ?? mkdtempSync(join(tmpdir(), 'live-')), burnout: { strategist: 10, copywriter: 15, designer: 5 }, morale: { strategist: 75, copywriter: 65, designer: 70 } });
	run.start();
	const wait = async (f: () => boolean) => { while (!f()) { if (run.state.phase === 'failed') throw new Error(run.state.error ?? 'failed'); await new Promise((r) => setTimeout(r, 300)); } };
	// три погодження: позиціонування, назва, знак — беремо перший варіант
	await wait(() => run.state.phase === 'pick_position');
	writeFileSync(OUT.replace('.json', '-positions.json'), JSON.stringify(run.state.posOptions, null, 1));
	run.decide({ action: 'pick', index: 0 });
	await wait(() => run.state.phase === 'pick_name');
	writeFileSync(OUT.replace('.json', '-names.json'), JSON.stringify(run.state.options, null, 1));
	run.decide({ action: 'pick', index: 0 });
	await wait(() => run.state.phase === 'pick_logo');
	writeFileSync(OUT.replace('.json', '-logos.json'), JSON.stringify(run.state.logoOptions, null, 1));
	run.decide({ action: 'pick', index: 0 });
	const tCore = Date.now() - t0;
	// клієнт: щоразу пробуємо ще коло, поки не скаже так або ні
	const snaps: { at: string; strategy: unknown; elements: unknown }[] = [];
	const snap = (at: string) => snaps.push({ at, strategy: structuredClone(run.state.strategy), elements: structuredClone(run.state.elements) });
	for (;;) {
		await wait(() => ['client_decision_core', 'client_decision_content', 'player_core', 'player_content', 'client_core', 'client_content', 'done'].includes(run.state.phase));
		const p = run.state.phase;
		if (p === 'done') break;
		if (p === 'client_core' || p === 'client_content') {
			snap(`${p}:${run.state.clientRound}`);
			const notes = p === 'client_core' ? feedback.shift() : undefined;
			run.decide(notes ? { action: 'feedback', notes } : { action: 'continue' });
		} else if (p === 'player_content' && contentEdit && run.state.editAvailable) {
			snap('before_content_edit');
			run.decide({ action: 'edit', notes: contentEdit });
			contentEdit = null;
		} else if (p === 'player_content' || p === 'player_core') run.decide({ action: 'submit' });
		else {
			const v = run.state.verdicts.at(-1);
			// беремо всі правки клієнта, щоб побачити, як команда їх виконує
			run.decide(v?.verdict === 'rework' ? { action: 'retry', picks: v.demands.map((_, i) => i) } : { action: 'continue' });
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	writeFileSync(OUT, JSON.stringify({ ms: Date.now() - t0, coreMs: tCore, calls: run.state.calls, usd: run.state.costUsd, imagesUsd: run.state.imagesUsd, brief: run.state.brief, strategy: run.state.strategy, result: run.state.result, verdicts: run.state.verdicts, elements: run.state.elements, snaps, log: run.state.log, trace: run.trace }, null, 1));
}, 1500000);
