import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DAILY_COST, PIZZA_COST, ROLES, tierOf, type Brief, type BriefForm, type GameState, type Ledger, type Perks, type Role, type RunState } from '$lib/types';
import { log } from '../log';
import type { ModelClient } from '../model/client';
import type { ImageModel } from '../model/images';
import { customBrief, inboxFor } from './briefs';
import { Run, type Models } from './run';

/** Стартові баланси, які Влад назвав 04.10.2026; далі він вводить нові з консолей. */
const START_LEDGER = (): Ledger => ({
	claude: { usd: 2.2, at: '2026-10-04', spent: 0 },
	gemini: { usd: 5, at: '2026-10-04', spent: 0 }
});

const START_MONEY = 12000;
const START_REP = 15;
const REST = 35;
const REST_MORALE = 10;
const perksFor = (day: number): Perks => ({ day, coffee: false, pizza: false, praised: [] });
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Витрати за день на поточному рівні агенції. */
export const dailyCost = (reputation: number) => DAILY_COST[tierOf(reputation)];

export function newGame(): GameState {
	return {
		day: 1,
		money: START_MONEY,
		reputation: START_REP,
		burnout: { strategist: 10, copywriter: 15, designer: 5 },
		morale: { strategist: 75, copywriter: 65, designer: 70 },
		hp: { strategist: 100, copywriter: 100, designer: 100 },
		perks: perksFor(1),
		inbox: inboxFor(1, START_REP),
		history: [],
		activeRun: null,
		bankrupt: false,
		ledger: START_LEDGER()
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

	constructor(private o: { dataDir: string; model: ModelClient; images: ImageModel; models: Models }) {
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

	get imagesDemo() {
		return this.o.images.demo;
	}

	/** Влад вводить залишок з консолі — від цієї миті витрати рахуються заново. */
	setBalance(provider: 'claude' | 'gemini', usd: number): string | null {
		if (!Number.isFinite(usd) || usd < 0 || usd > 100000) return 'Невірна сума.';
		this.state.ledger[provider] = { usd: Math.round(usd * 100) / 100, at: new Date().toISOString().slice(0, 10), spent: 0 };
		this.save();
		return null;
	}

	private spend(provider: 'claude' | 'gemini', usd: number) {
		if (!usd) return;
		this.state.ledger[provider].spent += usd;
		this.dirty = true;
	}

	private dirty = false;

	/** Повний запис прогону: стан, усі запити й відповіді моделей — щоб розбирати, що агенти думали. */
	private archive(run: Run) {
		try {
			const dir = join(this.o.dataDir, 'runs');
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, `${run.id}.json`), JSON.stringify({ saved: new Date().toISOString(), state: run.state, trace: run.trace }, null, 1));
		} catch (e) {
			log('error', 'archive_failed', { run: run.id, msg: String(e).slice(0, 200) });
		}
	}

	private file() {
		return join(this.o.dataDir, 'save.json');
	}

	private load(): GameState {
		try {
			const s = { ...newGame(), ...(JSON.parse(readFileSync(this.file(), 'utf8')) as GameState) };
			s.ledger = { ...START_LEDGER(), ...(s.ledger ?? {}) };
			// Сейви до рівнів: брифи без рівня перегенеровуємо.
			if (s.inbox.some((b) => !b.tier)) s.inbox = inboxFor(s.day, s.reputation);
			if (!s.perks || s.perks.day !== s.day) s.perks = perksFor(s.day);
			return s;
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
		if (this.dirty) {
			this.dirty = false;
			this.save();
		}
	}

	/** Хто з команди вигорів повністю — без відпочинку новий бриф не взяти. */
	burnedOut(): string[] {
		return ROLES.filter((r) => this.state.burnout[r] >= 100);
	}

	start(input: { briefId?: string; custom?: BriefForm }): { run?: Run; error?: string } {
		if (this.state.bankrupt) return { error: 'Агенція збанкрутувала. Почни нову гру.' };
		if (this.state.activeRun && this.runs.get(this.state.activeRun)?.state.phase !== 'done') return { error: 'Спершу закінчи поточний бриф.' };
		if (this.burnedOut().length) return { error: 'Хтось у команді вигорів. Дай людям вихідний.' };

		let brief: Brief | undefined;
		if (input.custom) {
			const f = input.custom;
			const total = Object.values(f).join('').trim().length;
			if (f.business.trim().length < 3) return { error: 'Напиши, що за бізнес.' };
			if (total < 25) return { error: 'Бриф закороткий: додай цілі або побажання.' };
			if (total > 1500) return { error: 'Бриф задовгий, до 1500 знаків разом.' };
			brief = customBrief(f, this.state.day, this.state.reputation);
		} else brief = this.state.inbox.find((b) => b.id === input.briefId);
		if (!brief) return { error: 'Такого брифу нема у вхідних.' };

		const id = `r${Date.now().toString(36)}${(++this.counter).toString(36)}`;
		const run = new Run(id, brief, {
			model: this.o.model,
			images: this.o.images,
			models: this.o.models,
			dataDir: this.o.dataDir,
			burnout: { ...this.state.burnout },
			morale: { ...this.state.morale },
			onChange: (r) => this.notify(r),
			onFinish: (r) => this.settle(r),
			onSpend: (p, usd) => this.spend(p, usd)
		});
		this.runs.set(id, run);
		this.state.activeRun = id;
		this.state.inbox = this.state.inbox.filter((b) => b.id !== brief!.id);
		this.save();
		log('info', 'run_start', { run: id, brief: brief.id, custom: !!brief.custom, client: brief.client.name, business: brief.client.business });
		run.start();
		return { run };
	}

	/** Підсумок брифу: гроші, репутація, втома, новий день. */
	private settle(run: Run) {
		this.archive(run);
		const res = run.state.result;
		if (!res) {
			this.save();
			return;
		}
		const s = this.state;
		s.money += res.paid - dailyCost(s.reputation);
		s.reputation = clamp(s.reputation + res.repDelta);
		for (const r of ROLES) {
			s.burnout[r] = clamp(s.burnout[r] + res.burnoutDelta[r]);
			s.morale[r] = clamp(s.morale[r] + res.moraleDelta[r]);
		}
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
		s.perks = perksFor(s.day);
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
		for (const r of ROLES) {
			s.burnout[r] = Math.max(0, s.burnout[r] - REST);
			s.morale[r] = clamp(s.morale[r] + REST_MORALE);
		}
		s.money -= dailyCost(s.reputation);
		s.day += 1;
		s.perks = perksFor(s.day);
		s.inbox = inboxFor(s.day, s.reputation);
		s.bankrupt = s.money < 0;
		this.save();
		return null;
	}

	/** Кава всім (раз на день, −6 стресу), піца (раз на день, +8 моралі, 400 ₴), похвала (раз на день кожному, +6 моралі). */
	perk(kind: 'coffee' | 'pizza' | 'praise', role?: Role): string | null {
		const s = this.state;
		if (s.bankrupt) return 'Агенція збанкрутувала.';
		if (s.perks.day !== s.day) s.perks = perksFor(s.day);
		if (kind === 'coffee' && s.perks.coffee) return 'Кава сьогодні вже була. Кавоварка теж втомилась.';
		if (kind === 'pizza' && s.perks.pizza) return 'Піца сьогодні вже була.';
		if (kind === 'pizza' && s.money < PIZZA_COST) return 'Нема грошей на піцу.';
		if (kind === 'praise' && (!role || !ROLES.includes(role))) return 'Кого хвалимо?';
		if (kind === 'praise' && s.perks.praised.includes(role!)) return 'Сьогодні вже хвалив — вдруге звучить підозріло.';
		const run = s.activeRun ? this.runs.get(s.activeRun) : undefined;
		const live = run && run.state.phase !== 'done' && run.state.phase !== 'failed' ? run : undefined;
		if (kind === 'coffee') {
			s.perks.coffee = true;
			if (live) live.perk('coffee');
			else for (const r of ROLES) s.burnout[r] = Math.max(0, s.burnout[r] - 6);
		} else if (kind === 'pizza') {
			s.perks.pizza = true;
			s.money -= PIZZA_COST;
			if (live) live.perk('pizza');
			else for (const r of ROLES) s.morale[r] = clamp(s.morale[r] + 8);
		} else {
			s.perks.praised = [...s.perks.praised, role!];
			if (live) live.perk('praise', role);
			else s.morale[role!] = clamp(s.morale[role!] + 6);
		}
		log('info', 'perk', { kind, role });
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
