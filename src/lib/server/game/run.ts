import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	CONTENT, CORE, CORE_SHARE, EDIT_SLOTS, ELEMENT_OWNER, ELEMENT_TITLE, MAX_CLIENT_ROUNDS, ROLE_NAME, ROLES,
	type Brief, type Burnout, type ClientVerdict, type ContentElement, type ElementId, type ElementValue, type LogoSpec,
	type Role, type RunPhase, type RunResult, type RunState, type Speaker, type Spot, type StepKey
} from '$lib/types';
import { errFields, log } from '../log';
import { isAbortError, type CallPurpose, type ModelClient } from '../model/client';
import type { ImageModel } from '../model/images';
import { costUsd } from '../pricing';
import { rasterLogo } from '../raster';
import { GPT_CARD, PERSONA_CARD, clientCard, systemFor } from './characters';
import { qualityOf, reputationDelta } from './checks';
import { fake } from './fake';
import { indexFor, search } from './kb';
import {
	GPT_HABIT, GPT_QUESTION, SCHEMA, StepError, briefBlock, guide, normClient, normContent, normGpt, normHuddle, normLogo,
	normNaming, normPersona, normPositioning, normRead, normRename, normReposition, parseJson, prompt, readText, request,
	type Msg, type Pos, type Read
} from './steps';

export interface Models {
	agent: string;
	review: string;
	client: string;
	gpt: string;
}

export interface RunDeps {
	model: ModelClient;
	images: ImageModel;
	models: Models;
	dataDir: string;
	burnout: Burnout;
	morale: Burnout;
	onChange?: (run: Run) => void;
	onFinish?: (run: Run) => void;
	onSpend?: (provider: 'claude' | 'gemini', usd: number) => void;
}

/** Рішення гравця, на яке чекає бриф. */
export type Decision =
	| { action: 'pick'; index: number }
	| { action: 'submit' }
	| { action: 'edit'; notes: string[] }
	| { action: 'retry' }
	| { action: 'giveup' }
	| { action: 'continue' };

/** Запис одного виклику моделі — для архіву прогону (бачити, що агенти думали насправді). */
export interface TraceEntry {
	t: string;
	purpose: CallPurpose | 'image';
	who: string;
	model: string;
	prompt: string;
	response: string;
	stop: string | null;
	ms: number;
	usd: number;
}

const NOTE_MAX = 280;

function chance(seed: string): number {
	let h = 2166136261;
	for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
	return ((h >>> 0) % 1000) / 1000;
}

function humanError(e: unknown): string {
	if (e instanceof StepError) return `Агент зламався: ${e.message}. Закрий бриф і спробуй інший.`;
	const status = (e as { status?: number })?.status;
	if (status === 401) return 'Claude не прийняв ключ API. Перевір ANTHROPIC_API_KEY на сервері.';
	if (status === 429) return 'Claude просить пригальмувати (ліміт запитів). Спробуй за хвилину.';
	if (status === 529 || (status && status >= 500)) return 'Claude перевантажений. Спробуй трохи згодом.';
	return 'Не вдалося дістатися до Claude. Перевір мережу сервера.';
}

const lastUser = (messages: Msg[]) => {
	const m = [...messages].reverse().find((x) => x.role === 'user');
	return typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
};

/**
 * Один бриф. Порядок і «хто що бачить»:
 * 1. Стратегиня читає бриф сама (Four Points), іноді питає Джіпітенка.
 * 2. Радиться: копірайтер і дизайнер бачать бриф і її розбір, відповідають «ок/сумнів» (модель ревʼю, окремі розмови).
 * 3. Стратегиня — позиціонування з трьох кандидатів.
 * 4. Копірайтер — 3 варіанти «назва + слоган», гравець обирає один.
 * 5. Дизайнер — знак під обрану назву.
 * 6. Гравець: показати клієнту або один раунд до 3 правок; переробка узгоджена (позиціонування → назва → знак).
 * 7. Клієнт: так / ще коло з його правками (вирішує гравець) / ні. До трьох кіл.
 * 8. Після «так» — канали коротко + картинки Gemini, знову гравець і клієнт, потім оплата.
 */
export class Run {
	readonly state: RunState;
	readonly trace: TraceEntry[] = [];
	private abort = new AbortController();
	private history: Record<Role, Msg[]> = { strategist: [], copywriter: [], designer: [] };
	private locks: Record<Role, Promise<unknown>> = { strategist: Promise.resolve(), copywriter: Promise.resolve(), designer: Promise.resolve() };
	private read: Read | null = null;
	private pos: Pos = { positioning: '', role: '', enemy: '' };
	private waiter: { phases: RunPhase[]; resolve: (d: Decision) => void } | null = null;
	private resume: (() => void) | null = null;
	private seq = 0;
	private coreAccepted = false;
	private contentAccepted = false;
	readonly burnoutDelta: Burnout = { strategist: 0, copywriter: 0, designer: 0 };
	readonly moraleDelta: Burnout = { strategist: 0, copywriter: 0, designer: 0 };

	constructor(readonly id: string, brief: Brief, private deps: RunDeps) {
		this.state = {
			id,
			brief,
			phase: 'read',
			status: 'Команда відкриває бриф',
			paused: false,
			agents: {
				strategist: { status: 'idle', spot: 'desk', burnout: deps.burnout.strategist, morale: deps.morale.strategist, hp: 100, doing: 'на місці' },
				copywriter: { status: 'idle', spot: 'desk', burnout: deps.burnout.copywriter, morale: deps.morale.copywriter, hp: 100, doing: 'на місці' },
				designer: { status: 'idle', spot: 'desk', burnout: deps.burnout.designer, morale: deps.morale.designer, hp: 100, doing: 'на місці' }
			},
			clientInOffice: false,
			elements: {},
			strategy: null,
			steps: [],
			options: [],
			editAvailable: false,
			clientRound: 0,
			speech: [],
			log: [],
			verdicts: [],
			result: null,
			error: null,
			demo: deps.model.demo,
			calls: 0,
			costUsd: 0,
			imagesUsd: 0
		};
	}

	/* ─────────── події ─────────── */

	private emit() {
		this.deps.onChange?.(this);
	}

	private say(who: Speaker, text: string, kind: 'thought' | 'gpt' | 'client' | 'system' = 'thought', to?: Role, more?: string[]) {
		if (!text) return;
		const seq = ++this.seq;
		this.state.speech = [...this.state.speech.slice(-29), { seq, who, text, kind, to }];
		this.state.log = [...this.state.log.slice(-299), { seq, who, text, ...(more?.length ? { more } : {}) }];
		this.emit();
	}

	private note(text: string, more?: string[]) {
		this.state.log = [...this.state.log.slice(-299), { seq: ++this.seq, who: 'system', text, ...(more?.length ? { more } : {}) }];
		this.emit();
	}

	private phase(p: RunPhase, status: string, spots?: Partial<Record<Role, Spot>>) {
		this.state.phase = p;
		this.state.status = status;
		if (spots) for (const r of ROLES) if (spots[r]) this.state.agents[r].spot = spots[r]!;
		log('info', 'run_phase', { run: this.id, phase: p });
		this.emit();
	}

	private agent(r: Role, status: RunState['agents'][Role]['status'], doing?: string) {
		this.state.agents[r].status = status;
		if (doing) this.state.agents[r].doing = doing;
		this.emit();
	}

	private tire(r: Role, n: number) {
		this.burnoutDelta[r] += n;
		this.state.agents[r].burnout = this.burnoutOf(r);
	}

	private burnoutOf(r: Role) {
		return Math.max(0, Math.min(100, this.deps.burnout[r] + this.burnoutDelta[r]));
	}

	private moraleOf(r: Role) {
		return Math.max(0, Math.min(100, this.deps.morale[r] + this.moraleDelta[r]));
	}

	/** Мораль: мінус — клієнт незадоволений, плюс — перемоги, похвала, піца. */
	private cheer(n: number, roles: Role[] = ROLES) {
		for (const r of roles) {
			this.moraleDelta[r] += n;
			this.state.agents[r].morale = this.moraleOf(r);
		}
	}

	/** Дії керівника для команди під час брифу (кава, піца, похвала). Гроші за піцу знімає гра. */
	perk(kind: 'coffee' | 'pizza' | 'praise', role?: Role) {
		if (kind === 'coffee') for (const r of ROLES) { this.burnoutDelta[r] -= 6; this.state.agents[r].burnout = this.burnoutOf(r); }
		if (kind === 'pizza') this.cheer(8);
		if (kind === 'praise' && role) this.cheer(6, [role]);
		this.emit();
	}

	/** Запис етапу: що сталося, щоб гравець міг повернутись і переглянути. */
	private record(key: StepKey, lines: string[], logo?: LogoSpec) {
		const steps = [...this.state.steps];
		const i = steps.findIndex((x) => x.key === key);
		const cur = i >= 0 ? steps[i] : { key, lines: [] };
		const next = { ...cur, lines: [...cur.lines, ...lines.filter(Boolean)], ...(logo ? { logos: [...(cur.logos ?? []), logo] } : {}) };
		if (i >= 0) steps[i] = next;
		else steps.push(next);
		this.state.steps = steps;
	}

	private alive() {
		if (this.abort.signal.aborted) {
			const e = new Error('aborted');
			e.name = 'AbortError';
			throw e;
		}
	}

	/** Між кроками: якщо гравець поставив паузу — чекаємо. */
	private async gate() {
		this.alive();
		if (this.state.paused) await new Promise<void>((r) => (this.resume = r));
		this.alive();
	}

	setPaused(on: boolean) {
		if (this.state.phase === 'done' || this.state.phase === 'failed') return;
		this.state.paused = on;
		if (!on && this.resume) {
			const r = this.resume;
			this.resume = null;
			r();
		}
		this.emit();
	}

	/* ─────────── виклики ─────────── */

	private async call(o: { purpose: CallPurpose; who: string; model: string; system: string; messages: Msg[]; schema: Record<string, unknown>; fake: () => unknown }) {
		this.alive();
		const started = Date.now();
		const r = await this.deps.model.call(request({ model: o.model, system: o.system, messages: o.messages, schema: o.schema }), {
			purpose: o.purpose,
			who: `${this.id}:${o.who}`,
			signal: this.abort.signal,
			fake: o.fake
		});
		this.alive();
		const usd = costUsd(r.model, r.usage);
		this.state.calls++;
		this.state.costUsd += usd;
		this.deps.onSpend?.('claude', usd);
		this.trace.push({ t: new Date().toISOString(), purpose: o.purpose, who: o.who, model: r.model, prompt: lastUser(o.messages), response: r.text, stop: r.stopReason, ms: Date.now() - started, usd });
		if (r.stopReason === 'refusal') throw new StepError('Claude відмовився відповідати на цей бриф');
		if (r.stopReason === 'max_tokens') throw new StepError('відповідь обірвалась на півслові');
		return r;
	}

	/** Хід у власній розмові агента: історія лише дописується, ходи одного агента — по черзі. */
	private ask(role: Role, purpose: CallPurpose, user: string, schema: Record<string, unknown>, fakeFn: () => unknown): Promise<Record<string, unknown>> {
		const job = this.locks[role].catch(() => undefined).then(async () => {
			const messages: Msg[] = [...this.history[role], { role: 'user', content: user + guide(schema) }];
			const r = await this.call({ purpose, who: role, model: this.deps.models.agent, system: systemFor(role, this.burnoutOf(role), this.moraleOf(role)), messages, schema, fake: fakeFn });
			this.history[role] = [...messages, { role: 'assistant', content: r.content }];
			this.tire(role, 3);
			return parseJson(r.text);
		});
		this.locks[role] = job;
		return job;
	}

	/** Окремий виклик без історії агента (порада колезі, клієнт, персона). */
	private async once(o: { purpose: CallPurpose; who: string; model: string; system: string; user: string; schema: Record<string, unknown>; fake: () => unknown }) {
		const r = await this.call({ ...o, messages: [{ role: 'user', content: o.user + guide(o.schema) }] });
		return parseJson(r.text);
	}

	private async maybeGpt(role: Role, step: 'read' | 'naming'): Promise<string | undefined> {
		if (chance(`${this.id}:${role}:${step}`) >= GPT_HABIT[role]) return undefined;
		const question = step === 'read' ? GPT_QUESTION.read(role, this.state.brief) : GPT_QUESTION.naming(this.state.brief);
		this.agent(role, 'gpt', 'радиться з Джіпітенком');
		this.say(role, `Джіпітенко, ${question}`, 'system');
		const index = await indexFor(this.deps.dataDir, role);
		const chunks = search(index, `${this.state.brief.client.business} ${this.state.brief.text} ${question}`, 3);
		const g = normGpt(await this.once({
			purpose: 'gpt', who: `gpt:${role}`, model: this.deps.models.gpt, system: GPT_CARD,
			user: prompt.gpt(role, question, chunks), schema: SCHEMA.gpt, fake: () => fake.gpt(chunks[0]?.source ?? '')
		}));
		this.say('gpt', g.source && g.source !== 'загальні знання' ? `${g.answer} (з бази: ${g.source})` : g.answer, 'gpt', role);
		this.agent(role, 'thinking');
		return g.answer;
	}

	/* ─────────── гравець ─────────── */

	private wait(phases: RunPhase[]): Promise<Decision> {
		return new Promise((resolve) => (this.waiter = { phases, resolve }));
	}

	/** Рішення гравця. Повертає текст помилки або null. */
	decide(d: Decision): string | null {
		const w = this.waiter;
		if (!w || !w.phases.includes(this.state.phase)) return 'Зараз команда не чекає твого рішення.';
		const p = this.state.phase;
		if (d.action === 'pick') {
			if (p !== 'pick_name') return 'Зараз не обирають назву.';
			if (!Number.isInteger(d.index) || d.index < 0 || d.index >= this.state.options.length) return 'Нема такого варіанта.';
		} else if (d.action === 'submit') {
			if (p !== 'player_core' && p !== 'player_content') return 'Зараз нема чого показувати клієнту.';
		} else if (d.action === 'edit') {
			if (p !== 'player_core' && p !== 'player_content') return 'Зараз правки не приймаються.';
			if (!this.state.editAvailable) return 'Раунд правок на цьому етапі вже використано.';
			const notes = d.notes.map((n) => String(n ?? '').trim()).filter(Boolean);
			if (!notes.length) return 'Напиши хоча б одну правку.';
			if (notes.length > EDIT_SLOTS) return `Не більше ${EDIT_SLOTS} правок.`;
			if (notes.some((n) => n.length > NOTE_MAX)) return `Кожна правка — до ${NOTE_MAX} знаків.`;
			d = { action: 'edit', notes };
		} else if (d.action === 'retry' || d.action === 'giveup' || d.action === 'continue') {
			if (p !== 'client_decision_core' && p !== 'client_decision_content') return 'Зараз клієнт не чекає відповіді.';
			const v = this.state.verdicts.at(-1)?.verdict;
			if (d.action === 'continue' && v === 'rework') return 'Клієнт чекає: ще коло чи кидаємо проєкт?';
			if (d.action !== 'continue' && v !== 'rework') return 'Тут лише «далі».';
		}
		this.waiter = null;
		w.resolve(d);
		return null;
	}

	/* ─────────── сценарій ─────────── */

	start() {
		this.play().catch((e) => {
			if (isAbortError(e)) return;
			this.state.error = humanError(e);
			log('error', 'run_failed', { run: this.id, phase: this.state.phase, ...errFields(e) });
			this.phase('failed', 'Бриф зупинився через помилку');
			for (const r of ROLES) this.state.agents[r].status = 'idle';
			this.note(this.state.error);
			this.deps.onFinish?.(this);
		});
	}

	private async play() {
		const b = this.state.brief;
		if (b.custom) await this.persona();
		this.note(`Бриф від ${b.client.name}, ${b.client.business}. Гонорар ${b.fee.toLocaleString('uk-UA')} ₴.`);

		// 1. стратегиня читає сама
		this.phase('read', 'Стратегиня читає бриф', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		this.agent('copywriter', 'idle', 'чекає на стратегиню');
		this.agent('designer', 'idle', 'чекає на стратегиню');
		await this.gate();
		this.agent('strategist', 'thinking', 'читає бриф');
		const gpt = await this.maybeGpt('strategist', 'read');
		this.read = normRead(await this.ask('strategist', 'read', prompt.read(b, gpt), SCHEMA.read, () => fake.read(b, !!gpt)));
		this.say('strategist', this.read.thought, 'thought', undefined, readText(this.read).split('\n'));
		this.state.strategy = { problem: this.read.problem, insight: this.read.insight, advantage: this.read.advantage, direction: this.read.direction };
		this.record('strategy', readText(this.read).split('\n'));
		if (this.read.gptTake) this.note(`Стратегиня про Джіпітенка: ${this.read.gptTake}`);

		// 2. радиться з колегами
		await this.gate();
		this.phase('huddle', 'Стратегиня радиться з колегами', { strategist: 'table', copywriter: 'table', designer: 'table' });
		this.agent('strategist', 'idle', 'розповідає напрям');
		this.say('strategist', this.read.direction, 'thought');
		const notes = await Promise.all((['copywriter', 'designer'] as const).map(async (r) => {
			await this.gate();
			this.agent(r, 'thinking', 'слухає стратегиню');
			const h = normHuddle(await this.once({
				purpose: 'review', who: r, model: this.deps.models.review, system: systemFor(r, this.burnoutOf(r)),
				user: prompt.huddle(r, b, this.read!), schema: SCHEMA.huddle, fake: () => fake.huddle(r)
			}));
			this.tire(r, 2);
			this.say(r, h.thought, 'thought', undefined, [`${h.ok ? 'Ок' : 'Сумнів'}: ${h.note}`]);
			this.agent(r, 'done', h.ok ? 'погодився' : 'має сумнів');
			return { role: r as Role, text: `${h.ok ? 'ок' : 'сумнів'} — ${h.note}` };
		}));
		this.record('strategy', notes.map((n) => `${ROLE_NAME[n.role]}: ${n.text}`));

		// 3. позиціонування
		await this.gate();
		this.phase('position', 'Стратегиня формулює позиціонування', { strategist: 'board', copywriter: 'desk', designer: 'desk' });
		this.agent('strategist', 'thinking', 'пише позиціонування');
		const p = normPositioning(await this.ask('strategist', 'core', prompt.positioning(notes), SCHEMA.positioning, () => fake.positioning(b)));
		this.pos = { positioning: p.positioning, role: p.role, enemy: p.enemy };
		this.setEl('positioning', p.positioning, [`Роль: ${p.role}`, `Ворог: ${p.enemy}`], { rejected: p.rejected, why: p.why });
		this.record('strategy', [`Позиціонування: ${p.positioning}`, ...p.rejected.map((r) => `Відкинула: ${r.text} — ${r.reason}`)]);
		this.say('strategist', p.thought, 'thought', undefined, [p.positioning, ...p.rejected.map((r) => `відкинула: ${r.text} — ${r.reason}`)]);
		this.agent('strategist', 'done', 'позиціонування готове');

		// 4. назва: 3 варіанти, обирає гравець
		await this.gate();
		this.phase('naming', 'Копірайтер шукає назву', { strategist: 'coffee' });
		this.agent('copywriter', 'thinking', 'шукає назву');
		const g2 = await this.maybeGpt('copywriter', 'naming');
		const nm = normNaming(await this.ask('copywriter', 'core', prompt.naming(this.pos, g2), SCHEMA.naming, () => fake.naming(!!g2)));
		this.state.options = nm.options;
		this.say('copywriter', nm.thought, 'thought', undefined, nm.options.map((o) => `${o.name} — «${o.slogan}» (${o.why})`));
		if (nm.gptTake) this.note(`Копірайтер про Джіпітенка: ${nm.gptTake}`);
		this.agent('copywriter', 'idle', 'чекає твого вибору');
		this.phase('pick_name', 'Обери назву й слоган — із цим піде дизайнер', { copywriter: 'table', strategist: 'table' });
		const pick = (await this.wait(['pick_name'])) as { action: 'pick'; index: number };
		const chosen = this.state.options[pick.index];
		this.setEl('name', chosen.name, [], { why: chosen.why, rejected: this.state.options.filter((_, i) => i !== pick.index).map((o) => ({ text: o.name, reason: o.slogan })) });
		this.setEl('slogan', chosen.slogan, [], { why: chosen.why });
		this.record('name', this.state.options.map((o, i) => `${i === pick.index ? 'Обрано' : 'Варіант'}: ${o.name} — «${o.slogan}» (${o.why})`));
		this.note(`Ти обрав: ${chosen.name} — «${chosen.slogan}»`);
		this.history.copywriter.push({ role: 'user', content: `Керівник обрав варіант: ${chosen.name} — «${chosen.slogan}».` }, { role: 'assistant', content: '{"ok":true}' });

		// 5. знак
		await this.gate();
		this.phase('logo', 'Дизайнер малює знак', { designer: 'desk', copywriter: 'desk' });
		this.agent('designer', 'thinking', 'малює знак');
		const lg = await this.drawLogo('core', prompt.logo(this.pos, chosen.name, chosen.slogan));
		this.setEl('logo', lg.concept, [], { logo: lg.logo, why: lg.thought });
		this.record('logo', [lg.concept], lg.logo);
		this.say('designer', lg.thought, 'thought', undefined, [lg.concept]);
		this.agent('designer', 'done', 'знак готовий');

		// 6–7. гравець і клієнт по основі
		this.coreAccepted = await this.stage('core');
		if (!this.coreAccepted) return this.finish('reject');

		// 8. канали
		await this.gate();
		this.phase('content', 'Команда робить ідеї для каналів', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		await Promise.all(CONTENT.map((id) => this.contentStep(id)));
		await this.images();
		this.contentAccepted = await this.stage('content');
		this.finish(this.contentAccepted ? 'ok' : 'reject');
	}

	/** Знак з однією повторною спробою: порожній або невидимий знак дизайнер перемальовує. */
	private async drawLogo(purpose: 'core' | 'rework', text: string) {
		try {
			return normLogo(await this.ask('designer', purpose, text, SCHEMA.logo, () => fake.logo()));
		} catch (e) {
			if (!(e instanceof StepError)) throw e;
			log('warn', 'logo_retry', { run: this.id });
			return normLogo(await this.ask('designer', purpose, 'Знак вийшов порожнім: фігури без розміру або злились із тлом. Перемалюй: від 2 до 6 видимих фігур, радіуси й розміри не менше 6, кольори a і b контрастні до bg.', SCHEMA.logo, () => fake.logo()));
		}
	}

	private async persona() {
		const r = normPersona(await this.once({ purpose: 'client', who: 'persona', model: this.deps.models.gpt, system: PERSONA_CARD, user: prompt.persona(this.state.brief.text), schema: SCHEMA.persona, fake: () => fake.persona() }));
		this.state.brief = { ...this.state.brief, client: { ...this.state.brief.client, name: r.name, gender: r.gender, look: r.look, archetype: r.archetype || this.state.brief.client.archetype, voice: r.voice } };
		this.emit();
	}

	private setEl(id: ElementId, text: string, details: string[], extra: Partial<ElementValue> = {}) {
		const prev = this.state.elements[id];
		this.state.elements = {
			...this.state.elements,
			[id]: { id, text, details, reworks: prev?.reworks ?? 0, ...(prev?.rejected ? { rejected: prev.rejected } : {}), ...(prev?.logo ? { logo: prev.logo } : {}), ...(prev?.image ? { image: prev.image } : {}), ...extra }
		};
		this.emit();
	}

	private bump(id: ElementId) {
		const e = this.state.elements[id];
		if (e) this.setEl(id, e.text, e.details, { reworks: e.reworks + 1 });
	}

	/** Етап «гравець → клієнт» для основи або каналів, з колами переробки. */
	private async stage(stage: 'core' | 'content'): Promise<boolean> {
		const ids: ElementId[] = stage === 'core' ? CORE : CONTENT;
		const playerPhase: RunPhase = stage === 'core' ? 'player_core' : 'player_content';
		const decisionPhase: RunPhase = stage === 'core' ? 'client_decision_core' : 'client_decision_content';
		const you: StepKey = stage === 'core' ? 'you_core' : 'you_content';
		const them: StepKey = stage === 'core' ? 'client_core' : 'client_content';
		const name = this.state.brief.client.name;

		this.state.editAvailable = true;
		for (;;) {
			this.phase(playerPhase, this.state.editAvailable ? 'Твоє слово: глянь зведення, покажи клієнту або дай правки' : 'Правки враховано. Показуємо клієнту?', { strategist: 'table', copywriter: 'table', designer: 'table' });
			for (const r of ROLES) this.agent(r, 'idle', 'чекає твого рішення');
			const d = await this.wait([playerPhase]);
			if (d.action !== 'edit') break;
			this.state.editAvailable = false;
			this.record(you, d.notes.map((n) => `Твоя правка: ${n}`));
			this.note('Твої правки', d.notes);
			await this.rework(stage, 'керівник агенції', d.notes);
		}
		this.state.editAvailable = false;
		this.record(you, ['Показав клієнту']);

		this.state.clientInOffice = true;
		for (let round = 1; round <= MAX_CLIENT_ROUNDS; round++) {
			this.state.clientRound = round;
			this.phase(stage === 'core' ? 'client_core' : 'client_content', `${name} дивиться роботу${round > 1 ? ` (коло ${round})` : ''}`, { strategist: 'table', copywriter: 'table', designer: 'table' });
			for (const r of ROLES) this.agent(r, 'idle', 'нервово чекає');
			await this.gate();
			const last = round === MAX_CLIENT_ROUNDS;
			const items = ids.map((id) => this.state.elements[id]).filter((e): e is ElementValue => !!e);
			const c = normClient(await this.once({
				purpose: 'client', who: 'client', model: this.deps.models.client, system: clientCard(this.state.brief.client, this.state.brief.text),
				user: prompt.client(items, round, last, stage === 'content' ? `Основу (${this.state.elements.name?.text}, «${this.state.elements.slogan?.text}») ти вже затвердив.` : undefined),
				schema: SCHEMA.client, fake: () => fake.client(round, stage)
			}), last);
			const v: ClientVerdict = { stage, round, ...c };
			for (const line of c.lines) this.say('client', line, 'client');
			this.state.verdicts = [...this.state.verdicts, v];
			this.record(them, [`Коло ${round}: ${c.lines.join(' / ')}`, `Підсумок: ${c.reaction}`, ...c.demands.map((x) => `Вимога: ${x}`)]);
			if (c.verdict === 'ok') this.cheer(stage === 'core' ? 6 : 8);
			else if (c.verdict === 'reject') this.cheer(-14);
			else this.cheer(-5);

			const word = c.verdict === 'ok' ? `${name} приймає` : c.verdict === 'reject' ? `${name} відмовляється` : `${name} хоче правок`;
			this.note(word, [c.reaction, ...c.demands]);
			this.phase(decisionPhase, c.verdict === 'rework' ? `${word}. Ще коло чи кидаємо проєкт?` : word);
			for (const r of ROLES) this.agent(r, 'idle', c.verdict === 'ok' ? 'видихає' : c.verdict === 'reject' ? 'засмучений(а)' : 'зітхає');
			const d = await this.wait([decisionPhase]);
			if (c.verdict !== 'rework') {
				this.state.clientInOffice = false;
				return c.verdict === 'ok';
			}
			if (d.action === 'giveup') {
				this.note('Ти кинув проєкт.');
				this.record(them, ['Ти кинув проєкт']);
				this.cheer(-6);
				this.state.clientInOffice = false;
				return false;
			}
			await this.rework(stage, 'клієнт', c.demands);
			for (const r of ROLES) this.tire(r, 3);
		}
		this.state.clientInOffice = false;
		return false;
	}

	/** Узгоджена переробка: позиціонування → назва й слоган → знак (або канали). */
	private async rework(stage: 'core' | 'content', who: 'керівник агенції' | 'клієнт', notes: string[]) {
		this.phase(stage === 'core' ? 'rework_core' : 'rework_content', who === 'клієнт' ? 'Переробляємо під клієнта' : 'Команда враховує твої правки', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		if (stage === 'core') {
			await this.gate();
			this.agent('strategist', 'thinking', 'переглядає позиціонування');
			const rp = normReposition(await this.ask('strategist', 'rework', prompt.reposition(who, notes, this.pos), SCHEMA.reposition, () => fake.reposition(who === 'клієнт')), this.pos);
			if (rp.changed) {
				this.pos = rp.pos;
				this.setEl('positioning', rp.pos.positioning, [`Роль: ${rp.pos.role}`, `Ворог: ${rp.pos.enemy}`]);
				this.bump('positioning');
			}
			this.say('strategist', rp.thought, 'thought', undefined, [rp.changed ? `Змінила: ${rp.why}` : 'Позиціонування лишила']);
			this.agent('strategist', 'done', rp.changed ? 'оновила позиціонування' : 'лишила позиціонування');

			await this.gate();
			const name = this.state.elements.name?.text ?? '', slogan = this.state.elements.slogan?.text ?? '';
			this.agent('copywriter', 'thinking', 'переглядає назву й слоган');
			const rn = normRename(await this.ask('copywriter', 'rework', prompt.rename(who, notes, this.pos, rp.changed, name, slogan), SCHEMA.rename, () => fake.rename(who === 'клієнт')), name, slogan);
			if (rn.changed) {
				if (rn.name !== name) { this.setEl('name', rn.name, [rn.why].filter(Boolean)); this.bump('name'); }
				if (rn.slogan !== slogan) { this.setEl('slogan', rn.slogan, []); this.bump('slogan'); }
			}
			this.say('copywriter', rn.thought, 'thought', undefined, [rn.changed ? `${rn.name} — «${rn.slogan}»: ${rn.why}` : 'Назву й слоган лишив']);
			this.agent('copywriter', 'done', rn.changed ? 'оновив назву' : 'лишив назву');

			await this.gate();
			this.agent('designer', 'thinking', 'переглядає знак');
			const lg = await this.drawLogo('rework', prompt.relogo(who, notes, this.pos, this.state.elements.name?.text ?? ''));
			this.setEl('logo', lg.concept, [], { logo: lg.logo, why: lg.thought });
			this.record('logo', [`Після правок (${who}): ${lg.concept}`], lg.logo);
			this.bump('logo');
			this.say('designer', lg.thought, 'thought', undefined, [lg.concept]);
			this.agent('designer', 'done', 'оновив знак');
		} else {
			await Promise.all(CONTENT.map(async (id) => {
				const r = ELEMENT_OWNER[id];
				const cur = this.state.elements[id];
				if (!cur) return;
				await this.gate();
				this.agent(r, 'thinking', `переробляє ${ELEMENT_TITLE[id]}`);
				const out = normContent(id, await this.ask(r, 'rework', prompt.recontent(id, who, notes, cur), SCHEMA[id], () => fake.content(id)));
				this.setEl(id, out.text || cur.text, out.details.length ? out.details : cur.details);
				this.bump(id);
				this.say(r, out.thought);
				this.agent(r, 'done', 'переробив');
			}));
			await this.images();
		}
	}

	private pack(): string {
		const e = this.state.elements;
		return [`- Позиціонування: ${this.pos.positioning}`, `- Роль бренду: ${this.pos.role}; ворог: ${this.pos.enemy}`, `- Назва: ${e.name?.text ?? '—'}`, `- Слоган: ${e.slogan?.text ?? '—'}`, `- Знак: ${e.logo?.text ?? '—'}`].join('\n');
	}

	private async contentStep(id: ContentElement) {
		const r = ELEMENT_OWNER[id];
		await this.gate();
		this.agent(r, 'thinking', `робить ${ELEMENT_TITLE[id]}`);
		const out = normContent(id, await this.ask(r, 'content', prompt.content(id, this.pack()), SCHEMA[id], () => fake.content(id)));
		this.setEl(id, out.text, out.details);
		this.say(r, out.thought, 'thought', undefined, [out.text, ...out.details]);
		this.record('content', [`${ELEMENT_TITLE[id]}: ${[out.text, ...out.details].join(' · ')}`]);
		this.agent(r, 'done', `${ELEMENT_TITLE[id]} готово`);
	}

	/** Банер Instagram і обкладинка YouTube у піксельному стилі гри (Gemini). Без ключа — заглушки; збій картинки бриф не валить. */
	private async images() {
		await this.gate();
		this.phase('images', 'Дизайнер малює банер і обкладинку ролика', { designer: 'desk' });
		this.agent('designer', 'thinking', 'малює банер і обкладинку');
		const e = this.state.elements;
		const logoPng = e.logo?.logo ? rasterLogo(e.logo.logo, 256) : null;
		const refs = logoPng ? [{ mime: 'image/png', data: logoPng }] : [];
		const STYLE = 'Pixel art in the cozy style of Stardew Valley: chunky visible pixels, warm saturated palette, dark coloured outlines (not black), soft dithering, no photorealism, no 3D-render gradients.';
		const brand = `Brand name: «${e.name?.text ?? ''}». Slogan (Ukrainian, keep exactly): «${e.slogan?.text ?? ''}».`;
		const mark = logoPng ? 'Place the provided pixel logo (first image) as the brand mark, keep its shapes and colours exactly.' : '';
		const colours = `Use the brand colours ${e.logo?.logo?.palette.a ?? ''} and ${e.logo?.logo?.palette.b ?? ''}. All text must be crisp pixel text, spelled exactly, nothing else written.`;
		const jobs: { id: 'instagram' | 'youtube'; prompt: string; aspect: '1:1' | '16:9' }[] = [
			{
				id: 'instagram', aspect: '1:1',
				prompt: `${STYLE}\nA square Instagram ad banner. ${brand}\nHeadline in big pixel font (Ukrainian, keep exactly): «${e.instagram?.text ?? ''}».\nScene: ${e.instagram?.details[0] ?? ''}.\n${mark} Put it in a corner.\n${colours}`
			},
			{
				id: 'youtube', aspect: '16:9',
				prompt: `${STYLE}\nA YouTube video thumbnail (cover) for a premium brand film, one single scene, cinematic composition, readable at small size.\nVideo title in big pixel font (Ukrainian, keep exactly): «${e.youtube?.text ?? ''}». ${brand}\nScene on the cover: ${e.youtube?.details[0] ?? ''}.\n${mark} Small, in a corner.\n${colours}`
			}
		];
		await Promise.all(jobs.map(async (j) => {
			try {
				const started = Date.now();
				const img = await this.deps.images.generate(j.prompt, refs, { aspect: j.aspect, who: `${this.id}:${j.id}`, signal: this.abort.signal });
				this.alive();
				const dir = join(this.deps.dataDir, 'images', this.id);
				mkdirSync(dir, { recursive: true });
				const file = `${j.id}-${Date.now().toString(36)}.${img.mime.includes('png') ? 'png' : 'jpg'}`;
				writeFileSync(join(dir, file), img.data);
				this.state.imagesUsd += img.usd;
				this.deps.onSpend?.('gemini', img.usd);
				this.trace.push({ t: new Date().toISOString(), purpose: 'image', who: j.id, model: this.deps.images.demo ? 'demo' : 'gemini', prompt: j.prompt, response: file, stop: null, ms: Date.now() - started, usd: img.usd });
				const cur = this.state.elements[j.id];
				if (cur) this.setEl(j.id, cur.text, cur.details, { image: `/api/images/${this.id}/${file}` });
			} catch (err) {
				if (isAbortError(err)) throw err;
				log('warn', 'image_failed', { run: this.id, id: j.id, msg: String((err as Error).message).slice(0, 200) });
				this.note(`Картинка «${ELEMENT_TITLE[j.id]}» не вийшла: ${(err as Error).message.slice(0, 120)}`);
			}
		}));
		this.agent('designer', 'done', 'картинки готові');
	}

	drop() {
		if (this.state.phase === 'done') return;
		const failed = this.state.phase === 'failed';
		this.abort.abort();
		this.waiter = null;
		this.resume?.();
		this.finish('dropped', failed);
	}

	/* ─────────── фінал ─────────── */

	private finish(verdict: 'ok' | 'reject' | 'dropped', free = false) {
		const elements = Object.values(this.state.elements).filter((e): e is ElementValue => !!e);
		const { quality, notes, performanceHits } = qualityOf(elements);
		const fee = this.state.brief.fee;
		const coreFee = Math.round((fee * CORE_SHARE) / 100) * 100;
		const pay: RunResult['pay'] = [];
		if (this.state.brief.prepay) pay.push({ label: 'Передплата', amount: this.state.brief.prepay });
		pay.push({ label: this.coreAccepted ? 'Основу прийнято (60% чеку)' : 'Основу не прийнято', amount: this.coreAccepted ? coreFee : 0 });
		if (this.coreAccepted) pay.push({ label: this.contentAccepted ? 'Канали прийнято (40% чеку)' : 'Канали не прийнято', amount: this.contentAccepted ? fee - coreFee : 0 });
		const paid = pay.reduce((n, p) => n + p.amount, 0);
		if (verdict === 'reject') for (const r of ROLES) this.tire(r, 8);
		if (verdict === 'dropped' && !free) this.cheer(-6);
		const repDelta = free ? 0 : reputationDelta(quality, verdict);
		const result: RunResult = {
			verdict, paid, pay, repDelta, quality,
			notes: [
				...notes.filter((n) => !n.ok).map((n) => `${ELEMENT_TITLE[n.element]}: ${n.text}`),
				...(performanceHits ? ['Клієнт протягнув перфоманс-штампи — індустрія це бачить.'] : [])
			],
			burnoutDelta: { ...this.burnoutDelta },
			moraleDelta: { ...this.moraleDelta }
		};
		this.state.result = result;
		this.state.clientInOffice = false;
		this.state.paused = false;
		this.record('done', pay.map((p) => `${p.label}: ${p.amount.toLocaleString('uk-UA')} ₴`));
		for (const r of ROLES) {
			this.state.agents[r].status = this.burnoutOf(r) >= 85 ? 'tired' : 'idle';
			this.state.agents[r].spot = 'coffee';
			this.state.agents[r].doing = verdict === 'ok' ? 'святкує з кавою' : 'пʼє каву мовчки';
		}
		const word = verdict === 'ok' ? 'Клієнт заплатив' : verdict === 'reject' ? (this.coreAccepted ? 'Канали не прийняли' : 'Клієнт пішов') : 'Проєкт кинуто';
		this.phase('done', `${word}: +${paid.toLocaleString('uk-UA')} ₴, репутація ${repDelta >= 0 ? '+' : ''}${repDelta}`);
		log('info', 'run_done', { run: this.id, verdict, paid, repDelta, quality, calls: this.state.calls, usd: Number(this.state.costUsd.toFixed(4)), images_usd: this.state.imagesUsd });
		this.deps.onFinish?.(this);
	}
}

export { ROLE_NAME };
