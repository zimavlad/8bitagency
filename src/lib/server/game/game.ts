import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROLES, type Brief, type GameState, type RunState } from '$lib/types';
import type { ModelClient } from '../model/client';
import { customBrief, inboxFor } from './briefs';
import { Run, type Models } from './run';

/** Зарплати трьох і оренда за день. */
export const DAILY_COST = 6000;
const START_MONEY = 30000;
const START_REP = 40;
const REST = 35;

export function newGame(): GameState {
	return {
		day: 1,
		money: START_MONEY,
		reputation: START_REP,
		burnout: { strategist: 10, copywriter: 15, designer: 5 },
		inbox: inboxFor(1, START_REP),
		history: [],
		activeRun: null,
		bankrupt: false
	};
}

type Listener = (s: RunState) => void;

/**
 * Одна гра на сервер (тул Влада). Стан гри — JSON на томі; активний бриф живе в памʼяті:
 * після перезапуску сервера він губиться, гра лишається. База — наступним етапом.
 */
export class Game {
	state: GameState;
	private runs = new Map<string, Run>();
	private listeners = new Map<string, Set<Listener>>();
	private counter = 0;

	constructor(private o: { dataDir: string; model: ModelClient; models: Models }) {
		this.state = this.load();
		// Бриф з минулого запуску сервера не відновлюється — звільняємо слот.
		if (this.state.activeRun) {
			this.state.activeRun = null;
			this.save();
		}
	}

	get demo() {
		return this.o.model.demo;
	}

	private file() {
		return join(this.o.dataDir, 'save.json');
	}

	private load(): GameState {
		try {
			return { ...newGame(), ...(JSON.parse(readFileSync(this.file(), 'utf8')) as GameState) };
		} catch {
			return newGame();
		}
	}

	private save() {
		mkdirSync(this.o.dataDir, { recursive: true });
		const tmp = `${this.file()}.tmp`;
		writeFileSync(tmp, JSON.stringify(this.state, null, 1));
		renameSync(tmp, this.file());
	}

	run(id: string): Run | undefined {
		return this.runs.get(id);
	}

	subscribe(id: string, fn: Listener): () => void {
		const set = this.listeners.get(id) ?? new Set();
		set.add(fn);
		this.listeners.set(id, set);
		return () => set.delete(fn);
	}

	private notify(run: Run) {
		for (const fn of this.listeners.get(run.id) ?? []) fn(run.state);
	}

	/** Хто з команди вигорів повністю — без відпочинку новий бриф не взяти. */
	burnedOut(): string[] {
		return ROLES.filter((r) => this.state.burnout[r] >= 100);
	}

	start(input: { briefId?: string; custom?: { text: string; business: string } }): { run?: Run; error?: string } {
		if (this.state.bankrupt) return { error: 'Агенція збанкрутувала. Почни нову гру.' };
		if (this.state.activeRun && this.runs.get(this.state.activeRun)?.state.phase !== 'done') return { error: 'Спершу закінчи поточний бриф.' };
		if (this.burnedOut().length) return { error: 'Хтось у команді вигорів. Дай людям вихідний.' };

		let brief: Brief | undefined;
		if (input.custom) {
			const text = input.custom.text.trim();
			if (text.length < 15) return { error: 'Бриф закороткий: напиши хоч речення, що за бізнес і що треба.' };
			if (text.length > 1200) return { error: 'Бриф задовгий, до 1200 знаків.' };
			brief = customBrief(text, input.custom.business.slice(0, 120), this.state.day);
		} else brief = this.state.inbox.find((b) => b.id === input.briefId);
		if (!brief) return { error: 'Такого брифу нема у вхідних.' };

		const id = `r${Date.now().toString(36)}${(++this.counter).toString(36)}`;
		const run = new Run(id, brief, {
			model: this.o.model,
			models: this.o.models,
			dataDir: this.o.dataDir,
			burnout: { ...this.state.burnout },
			onChange: (r) => this.notify(r),
			onFinish: (r) => this.settle(r)
		});
		this.runs.set(id, run);
		this.state.activeRun = id;
		this.state.inbox = this.state.inbox.filter((b) => b.id !== brief!.id);
		this.save();
		run.start();
		return { run };
	}

	/** Підсумок брифу: гроші, репутація, втома, новий день. */
	private settle(run: Run) {
		const res = run.state.result;
		if (!res) return;
		const s = this.state;
		s.money += res.paid - DAILY_COST;
		s.reputation = Math.max(0, Math.min(100, s.reputation + res.repDelta));
		for (const r of ROLES) s.burnout[r] = Math.max(0, Math.min(100, s.burnout[r] + res.burnoutDelta[r]));
		s.history = [
			{
				day: s.day,
				client: run.state.brief.client.name,
				business: run.state.brief.client.business,
				name: run.state.elements.name?.text ?? '—',
				verdict: res.verdict,
				paid: res.paid,
				repDelta: res.repDelta
			},
			...s.history
		].slice(0, 50);
		s.day += 1;
		s.inbox = inboxFor(s.day, s.reputation);
		s.activeRun = null;
		s.bankrupt = s.money < 0;
		this.save();
		this.notify(run);
		// Старі брифи з памʼяті прибираємо, лишаємо останній — щоб його було видно після завершення.
		for (const id of [...this.runs.keys()]) if (id !== run.id) this.runs.delete(id);
	}

	rest(): string | null {
		if (this.state.activeRun) return 'Спершу закінчи бриф.';
		if (this.state.bankrupt) return 'Агенція збанкрутувала.';
		const s = this.state;
		for (const r of ROLES) s.burnout[r] = Math.max(0, s.burnout[r] - REST);
		s.money -= DAILY_COST;
		s.day += 1;
		s.inbox = inboxFor(s.day, s.reputation);
		s.bankrupt = s.money < 0;
		this.save();
		return null;
	}

	reset() {
		for (const r of this.runs.values()) r.drop();
		this.runs.clear();
		this.state = newGame();
		this.save();
	}
}
