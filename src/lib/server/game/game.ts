import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DAY_START, DEADLINE_DAY, PIZZA_COST, PROMO_AFTER, ROLES, START_MONEY, dailyCost as costOf, type Brief, type BriefForm, type GameState, type Ledger, type Perks, type Role, type RunState, type Staff } from '$lib/types';
import { log } from '../log';
import { ledger, setLedger, spendLedger } from '../ledger';
import type { ModelClient } from '../model/client';
import type { ImageModel } from '../model/images';
import { caseOf } from '$lib/case';
import { customBrief, inboxFor } from './briefs';
import { Run, type Models } from './run';

/** Стартові баланси, які Влад назвав 04.10.2026; далі він вводить нові з консолей. */
const START_LEDGER = (): Ledger => ({
	claude: { usd: 2.2, at: '2026-10-04', spent: 0 },
	gemini: { usd: 5, at: '2026-10-04', spent: 0 }
});

const START_REP = 15;
const REST = 35;
const REST_MORALE = 10;
const perksFor = (day: number): Perks => ({ day, pizza: false, praised: [] });
const junior = (): Staff => ({ grade: 'junior', done: 0, sulk: false });
/** Похвала не працює, коли людина вже втомлена: тоді їй треба вихідний або гроші. */
export const PRAISE_MAX_STRESS = 60;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Витрати за день: оренда й зарплати за рівнем і грейдами. */
export const dailyCost = (s: GameState) => costOf(s.reputation, s.team);

export function newGame(): GameState {
	return {
		day: 1,
		money: START_MONEY,
		reputation: START_REP,
		burnout: { strategist: 10, copywriter: 15, designer: 5 },
		morale: { strategist: 75, copywriter: 65, designer: 70 },
		hp: { strategist: 100, copywriter: 100, designer: 100 },
		perks: perksFor(1),
		team: { strategist: junior(), copywriter: junior(), designer: junior() },
		ask: null,
		clock: DAY_START,
		over: null,
		investorOk: false,
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

	/** dataDir — спільні архів, картинки й база; saveFile — сейв цього гравця. */
	constructor(private o: { dataDir: string; saveFile?: string; player?: string; model: ModelClient; images: ImageModel; models: Models; paceMs?: number }) {
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
		setLedger(provider, usd);
		return null;
	}

	private spend(provider: 'claude' | 'gemini', usd: number) {
		spendLedger(provider, usd);
	}

	/** Стан для гравця: його гра + спільні на сервер рахунки API. */
	view(): GameState {
		return { ...this.state, ledger: ledger(this.o.dataDir) };
	}

	private dirty = false;

	/** Повний запис прогону: стан, усі запити й відповіді моделей — щоб розбирати, що агенти думали. */
	private archive(run: Run) {
		try {
			const dir = join(this.o.dataDir, 'runs');
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, `${run.id}.json`), JSON.stringify({ saved: new Date().toISOString(), player: this.o.player ?? 'main', state: run.state, trace: run.trace }, null, 1));
		} catch (e) {
			log('error', 'archive_failed', { run: run.id, msg: String(e).slice(0, 200) });
		}
	}

	private file() {
		return this.o.saveFile ?? join(this.o.dataDir, 'save.json');
	}

	private load(): GameState {
		try {
			const s = { ...newGame(), ...(JSON.parse(readFileSync(this.file(), 'utf8')) as GameState) };
			// Сейви до рівнів: брифи без рівня перегенеровуємо.
			if (s.inbox.some((b) => !b.tier || !b.client.role)) s.inbox = inboxFor(s.day, s.reputation);
			if (!s.perks || s.perks.day !== s.day) s.perks = perksFor(s.day);
			if (typeof s.clock !== 'number') s.clock = DAY_START;
			s.team = Object.fromEntries(ROLES.map((r) => [r, s.team?.[r] ?? junior()])) as GameState['team'];
			return s;
		} catch {
			return newGame();
		}
	}

	private save() {
		mkdirSync(dirname(this.file()), { recursive: true });
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
			staff: structuredClone(this.state.team),
			paceMs: this.o.paceMs ?? 0,
			clock: this.state.clock,
			onChange: (r) => this.notify(r),
			onFinish: (r) => this.settle(r),
			onSpend: (p, usd) => this.spend(p, usd)
		});
		this.runs.set(id, run);
		this.state.activeRun = id;
		this.state.inbox = this.state.inbox.filter((b) => b.id !== brief!.id);
		// Передплата 20% приходить одразу, щойно береш бриф.
		this.state.money += brief.prepay;
		this.save();
		log('info', 'run_start', { player: this.o.player ?? 'main', run: id, brief: brief.id, custom: !!brief.custom, client: brief.client.name, business: brief.client.business });
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
		s.money += res.paid - run.state.brief.prepay;
		s.reputation = clamp(s.reputation + res.repDelta);
		for (const r of ROLES) {
			s.burnout[r] = clamp(s.burnout[r] + res.burnoutDelta[r]);
			s.morale[r] = clamp(s.morale[r] + res.moraleDelta[r]);
		}
		if (res.verdict === 'ok') for (const r of ROLES) s.team[r].done += 1;
		// Після п'яти прийнятих проєктів джун приходить просити підвищення — по одному.
		if (!s.ask) s.ask = ROLES.find((r) => s.team[r].grade === 'junior' && !s.team[r].sulk && s.team[r].done >= PROMO_AFTER) ?? null;
		s.history = [
			{
				day: s.day,
				client: run.state.brief.client.name,
				business: run.state.brief.client.business,
				name: run.state.elements.name?.text ?? '—',
				verdict: res.verdict,
				paid: res.paid,
				repDelta: res.repDelta,
				case: caseOf(run.state)
			},
			...s.history
		].slice(0, 50);
		s.activeRun = null;
		this.nextDay();
		this.save();
		this.notify(run);
		// Старі брифи з памʼяті прибираємо, лишаємо останній — щоб його було видно після завершення.
		for (const id of [...this.runs.keys()]) if (id !== run.id) this.runs.delete(id);
	}

	/**
	 * Новий день: оренда й зарплати, стрес від 50% забирає здоров'я, нові брифи.
	 * На восьмий ранок інвестор дивиться на рахунок: у плюсі — живемо далі, ні — суд.
	 */
	private nextDay() {
		const s = this.state;
		s.money -= dailyCost(s);
		for (const r of ROLES) if (s.burnout[r] >= 50) s.hp[r] = clamp(s.hp[r] - 1);
		s.day += 1;
		s.clock = DAY_START;
		s.perks = perksFor(s.day);
		s.inbox = inboxFor(s.day, s.reputation);
		if (s.money < 0) s.over = 'bankrupt';
		else if (s.day === DEADLINE_DAY && !s.investorOk) {
			if (s.money > START_MONEY) s.investorOk = true;
			else s.over = 'investor';
		}
		s.bankrupt = !!s.over;
	}

	rest(): string | null {
		if (this.state.activeRun) return 'Спершу закінчи бриф.';
		if (this.state.bankrupt) return 'Гру закінчено.';
		const s = this.state;
		for (const r of ROLES) {
			s.burnout[r] = Math.max(0, s.burnout[r] - REST);
			s.morale[r] = clamp(s.morale[r] + REST_MORALE);
			// Образа минає після вихідного.
			s.team[r].sulk = false;
		}
		this.nextDay();
		this.save();
		return null;
	}

	/** Відповідь на прохання про підвищення: так — зарплата ×2 і мораль; ні — образа до вихідного. */
	answer(yes: boolean): string | null {
		const s = this.state;
		const r = s.ask;
		if (!r) return 'Ніхто нічого не просить.';
		if (yes) {
			s.team[r] = { ...s.team[r], grade: 'middle' };
			s.morale[r] = clamp(s.morale[r] + 15);
		} else {
			s.team[r] = { ...s.team[r], sulk: true, done: 0 };
			s.morale[r] = clamp(s.morale[r] - 25);
		}
		s.ask = null;
		log('info', 'promo_answer', { role: r, yes });
		this.save();
		return null;
	}

	/**
	 * Кава — скільки завгодно: мораль +1, але й стрес +1. Піца — раз на день, мораль +8 за 400 ₴.
	 * Похвала — раз на день кожному: +6 моралі, але при стресі понад 60% лише дратує (−4).
	 */
	perk(kind: 'coffee' | 'pizza' | 'praise', role?: Role): { error?: string; note?: string } {
		const s = this.state;
		if (s.bankrupt) return { error: 'Гру закінчено.' };
		if (s.perks.day !== s.day) s.perks = perksFor(s.day);
		if (kind === 'pizza' && s.perks.pizza) return { error: 'Піца сьогодні вже була.' };
		if (kind === 'pizza' && s.money < PIZZA_COST) return { error: 'Нема грошей на піцу.' };
		if (kind === 'praise' && (!role || !ROLES.includes(role))) return { error: 'Кого хвалимо?' };
		if (kind === 'praise' && s.perks.praised.includes(role!)) return { error: 'Сьогодні вже хвалив — вдруге звучить підозріло.' };
		const run = s.activeRun ? this.runs.get(s.activeRun) : undefined;
		const live = run && run.state.phase !== 'done' && run.state.phase !== 'failed' ? run : undefined;
		const stressOf = (r: Role) => (live ? live.state.agents[r].burnout : s.burnout[r]);
		const apply = (stress: Partial<Record<Role, number>>, morale: Partial<Record<Role, number>>) => {
			if (live) live.adjust(stress, morale);
			else for (const r of ROLES) {
				s.burnout[r] = clamp(s.burnout[r] + (stress[r] ?? 0));
				s.morale[r] = clamp(s.morale[r] + (morale[r] ?? 0));
			}
		};
		const all = (n: number) => Object.fromEntries(ROLES.map((r) => [r, n])) as Record<Role, number>;
		let note = '';
		if (kind === 'coffee') {
			apply(all(1), all(1));
			note = 'Кава готова: мораль +1, стрес +1';
		} else if (kind === 'pizza') {
			s.perks.pizza = true;
			s.money -= PIZZA_COST;
			apply({}, all(8));
			note = `Піца приїхала: мораль команди +8, −${PIZZA_COST} ₴`;
		} else {
			s.perks.praised = [...s.perks.praised, role!];
			if (stressOf(role!) > PRAISE_MAX_STRESS) {
				apply({}, { [role!]: -4 });
				note = 'Похвала не зайшла: втома понад 60%, треба вихідний або гроші. Мораль −4';
			} else {
				apply({}, { [role!]: 6 });
				note = 'Похвала зайшла: мораль +6';
			}
		}
		log('info', 'perk', { kind, role });
		this.save();
		return { note };
	}

	reset() {
		for (const r of this.runs.values()) r.drop();
		this.runs.clear();
		this.state = newGame();
		this.save();
	}
}
