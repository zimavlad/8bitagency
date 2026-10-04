import {
	CONTENT, CORE, ELEMENT_OWNER, ELEMENT_TITLE, ROLE_NAME, ROLES,
	type Brief, type Burnout, type ClientVerdict, type ContentElement, type CoreElement, type ElementId,
	type ElementValue, type Role, type RunPhase, type RunResult, type RunState, type Speaker, type Speech, type Spot
} from '$lib/types';
import { isAbortError, type ModelClient } from '../model/client';
import { costUsd } from '../pricing';
import { CLIENT_CARD, CLIENT_ROUND2, GPT_CARD, systemFor } from './characters';
import { qualityOf, quoteFound, reputationDelta } from './checks';
import { fake } from './fake';
import { indexFor, search } from './kb';
import {
	GPT_HABIT, GPT_QUESTION, SCHEMA, StepError, briefBlock, normClient, normContent, normGpt, normLogo, normNaming,
	guide, normPositioning, normRead, normReview, normRework, parseJson, prompt, readText, request, type Msg, type ReadOut, type ReviewOut
} from './steps';

export interface Models {
	/** Основна модель трьох агентів. */
	agent: string;
	/** Перехресне ревʼю — сильніша модель окремою розмовою. */
	review: string;
	client: string;
	gpt: string;
}

export interface RunDeps {
	model: ModelClient;
	models: Models;
	dataDir: string;
	/** Вигорання команди на старті брифу. */
	burnout: Burnout;
	onChange?: (run: Run) => void;
	onFinish?: (run: Run) => void;
}

const EDIT_MAX = 280;

/** Детерміноване «кинути монетку» для звички питати Джіпітенка. */
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

/**
 * Один бриф від початку до оплати. Фази й «хто що бачить»:
 * - read: кожен бачить лише бриф і свою картку (наосліп, паралельно);
 * - review: окрема розмова на моделі ревʼю — своє прочитання і прочитання двох колег;
 * - core: стратегиня бачить свою розмову і всі рецензії; копірайтер і дизайнер — позиціонування, роль і ворога, але не одне одного;
 * - гравець: одна правка на кожен елемент; клієнт: одна хвиля правок, потім «так» або «ні».
 */
export class Run {
	readonly state: RunState;
	private abort = new AbortController();
	private history: Record<Role, Msg[]> = { strategist: [], copywriter: [], designer: [] };
	private locks: Record<Role, Promise<unknown>> = { strategist: Promise.resolve(), copywriter: Promise.resolve(), designer: Promise.resolve() };
	private reads: Partial<Record<Role, ReadOut>> = {};
	private reviews: Partial<Record<Role, ReviewOut>> = {};
	private pos = { positioning: '', role: '', enemy: '' };
	private edited = new Set<ElementId>();
	private waiter: (() => void) | null = null;
	private busy = false;
	private seq = 0;
	private coreAccepted = false;
	readonly burnoutDelta: Burnout = { strategist: 0, copywriter: 0, designer: 0 };

	constructor(readonly id: string, brief: Brief, private deps: RunDeps) {
		this.state = {
			id,
			brief,
			phase: 'read',
			status: 'Команда відкриває бриф',
			agents: {
				strategist: { status: 'idle', spot: 'desk', burnout: deps.burnout.strategist },
				copywriter: { status: 'idle', spot: 'desk', burnout: deps.burnout.copywriter },
				designer: { status: 'idle', spot: 'desk', burnout: deps.burnout.designer }
			},
			clientInOffice: false,
			elements: {},
			speech: [],
			log: [],
			verdicts: [],
			result: null,
			error: null,
			demo: deps.model.demo,
			calls: 0,
			costUsd: 0
		};
	}

	/* ─────────── події ─────────── */

	private emit() {
		this.deps.onChange?.(this);
	}

	private say(who: Speaker, text: string, kind: Speech['kind'] = 'thought', to?: Role) {
		if (!text) return;
		const seq = ++this.seq;
		this.state.speech = [...this.state.speech.slice(-29), { seq, who, text, kind, to }];
		this.state.log = [...this.state.log.slice(-199), { seq, who, text }];
		this.emit();
	}

	private note(text: string) {
		this.state.log = [...this.state.log.slice(-199), { seq: ++this.seq, who: 'system', text }];
		this.emit();
	}

	private phase(p: RunPhase, status: string, spots?: Partial<Record<Role, Spot>>) {
		this.state.phase = p;
		this.state.status = status;
		if (spots) for (const r of ROLES) if (spots[r]) this.state.agents[r].spot = spots[r]!;
		this.emit();
	}

	private agent(r: Role, status: RunState['agents'][Role]['status']) {
		this.state.agents[r].status = status;
		this.emit();
	}

	private tire(r: Role, n: number) {
		this.burnoutDelta[r] += n;
		const v = Math.min(100, this.deps.burnout[r] + this.burnoutDelta[r]);
		this.state.agents[r].burnout = v;
	}

	private burnoutOf(r: Role) {
		return Math.min(100, this.deps.burnout[r] + this.burnoutDelta[r]);
	}

	private alive() {
		if (this.abort.signal.aborted) {
			const e = new Error('aborted');
			e.name = 'AbortError';
			throw e;
		}
	}

	/* ─────────── виклики ─────────── */

	private async call(o: { purpose: Parameters<ModelClient['call']>[1]['purpose']; who: string; model: string; system: string; messages: Msg[]; schema: Record<string, unknown>; fake: () => unknown }) {
		this.alive();
		const r = await this.deps.model.call(request({ model: o.model, system: o.system, messages: o.messages, schema: o.schema }), {
			purpose: o.purpose,
			who: o.who,
			signal: this.abort.signal,
			fake: o.fake
		});
		this.alive();
		this.state.calls++;
		this.state.costUsd += costUsd(r.model, r.usage);
		if (r.stopReason === 'refusal') throw new StepError('Claude відмовився відповідати на цей бриф');
		if (r.stopReason === 'max_tokens') throw new StepError('відповідь обірвалась на півслові');
		return r;
	}

	/** Хід агента в його власній розмові: історія лише дописується, ходи одного агента — по черзі. */
	private ask(role: Role, purpose: 'read' | 'core' | 'rework' | 'content', user: string, schema: Record<string, unknown>, fakeFn: () => unknown): Promise<Record<string, unknown>> {
		const job = this.locks[role].catch(() => undefined).then(async () => {
			const messages: Msg[] = [...this.history[role], { role: 'user', content: user + guide(schema) }];
			const r = await this.call({ purpose, who: role, model: this.deps.models.agent, system: systemFor(role, this.burnoutOf(role)), messages, schema, fake: fakeFn });
			this.history[role] = [...messages, { role: 'assistant', content: r.content }];
			this.tire(role, 3);
			return parseJson(r.text);
		});
		this.locks[role] = job;
		return job;
	}

	/** Іноді агент сам біжить до Джіпітенка; той відповідає з бази знань ролі. */
	private async maybeGpt(role: Role, step: 'read' | 'core'): Promise<string | undefined> {
		if (chance(`${this.id}:${role}:${step}`) >= GPT_HABIT[role]) return undefined;
		const question = GPT_QUESTION[step](role, this.state.brief);
		this.agent(role, 'gpt');
		this.say(role, `Джіпітенко, ${question}`, 'system');
		const index = await indexFor(this.deps.dataDir, role);
		const chunks = search(index, `${this.state.brief.client.business} ${this.state.brief.text} ${question}`, 3);
		const r = await this.call({
			purpose: 'gpt', who: `gpt:${role}`, model: this.deps.models.gpt, system: GPT_CARD,
			messages: [{ role: 'user', content: prompt.gpt(role, question, chunks) + guide(SCHEMA.gpt) }], schema: SCHEMA.gpt,
			fake: () => fake.gpt(role, chunks[0]?.source ?? '')
		});
		const g = normGpt(parseJson(r.text));
		const text = [g.answer, ...g.tips.map((t) => `• ${t}`)].join('\n');
		this.say('gpt', g.source && g.source !== 'загальні знання' ? `${text}\n(з бази: ${g.source})` : text, 'gpt', role);
		this.agent(role, 'thinking');
		return text;
	}

	/* ─────────── сценарій ─────────── */

	start() {
		this.play().catch((e) => {
			if (isAbortError(e)) return;
			this.state.error = humanError(e);
			this.phase('failed', 'Бриф зупинився через помилку');
			for (const r of ROLES) this.state.agents[r].status = 'idle';
			this.note(this.state.error);
		});
	}

	private async play() {
		const b = this.state.brief;
		this.note(`Бриф від ${b.client.name}, ${b.client.business}. Гонорар ${b.fee.toLocaleString('uk-UA')} ₴.`);

		this.phase('read', 'Кожен читає бриф сам', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		await Promise.all(ROLES.map((r) => this.readStep(r)));

		this.phase('review', 'Обговорення за столом переговорів', { strategist: 'table', copywriter: 'table', designer: 'table' });
		await Promise.all(ROLES.map((r) => this.reviewStep(r)));

		this.phase('core', 'Стратегиня формулює позиціонування', { strategist: 'board', copywriter: 'desk', designer: 'desk' });
		await this.positioningStep();
		this.state.status = 'Копірайтер і дизайнер працюють від позиціонування';
		this.state.agents.strategist.spot = 'coffee';
		await Promise.all([this.namingStep(), this.logoStep()]);

		this.phase('player_core', 'Твоє слово: затверди або дай по одній правці на елемент', { strategist: 'table', copywriter: 'table', designer: 'table' });
		for (const r of ROLES) this.agent(r, 'idle');
		await this.waitPlayer();

		this.coreAccepted = await this.clientStage('core', CORE);
		if (!this.coreAccepted) return this.finish('reject');

		this.phase('content', 'Команда робить контент для соцмереж і ролик', { strategist: 'desk', copywriter: 'desk', designer: 'desk' });
		await Promise.all(CONTENT.map((id) => this.contentStep(id)));

		this.phase('player_content', 'Твоє слово по контенту: по одній правці на елемент', { strategist: 'table', copywriter: 'table', designer: 'table' });
		for (const r of ROLES) this.agent(r, 'idle');
		await this.waitPlayer();

		const ok = await this.clientStage('content', CONTENT);
		this.finish(ok ? 'ok' : 'reject');
	}

	private async readStep(r: Role) {
		this.agent(r, 'thinking');
		const gpt = await this.maybeGpt(r, 'read');
		const out = normRead(await this.ask(r, 'read', prompt.read(r, this.state.brief, gpt), SCHEMA.read, () => fake.read(r, this.state.brief, !!gpt)));
		this.reads[r] = out;
		this.say(r, out.thought);
		if (out.gptTake) this.note(`${ROLE_NAME[r]} про пораду Джіпітенка: ${out.gptTake}`);
		this.agent(r, 'done');
	}

	private async reviewStep(r: Role) {
		this.agent(r, 'thinking');
		const peers = ROLES.filter((p) => p !== r).map((p) => ({ role: p, text: readText(this.reads[p]!) }));
		const own = readText(this.reads[r]!);
		// Окрема розмова на моделі ревʼю: модель посеред розмови агента не міняємо.
		const res = await this.call({
			purpose: 'review', who: r, model: this.deps.models.review, system: systemFor(r, this.burnoutOf(r)),
			messages: [{ role: 'user', content: `${briefBlock(this.state.brief)}\n\nТвоє прочитання:\n${own}\n\n${prompt.review(r, peers)}${guide(SCHEMA.review)}` }],
			schema: SCHEMA.review, fake: () => fake.review(r, peers)
		});
		this.tire(r, 3);
		const out = normReview(parseJson(res.text), r);
		const src = this.reads[out.weakest.whom] ? readText(this.reads[out.weakest.whom]!) : '';
		const honest = out.weakest.whom !== r && quoteFound(out.weakest.quote, src);
		this.reviews[r] = out;
		this.say(r, out.thought);
		this.note(`${ROLE_NAME[r]} → ${ROLE_NAME[out.weakest.whom]}: «${out.weakest.quote}» — ${out.weakest.why}${honest ? '' : ' (цитату перекручено)'}`);
		this.agent(r, 'done');
	}

	private reviewsText() {
		return ROLES.filter((r) => this.reviews[r]).map((r) => {
			const v = this.reviews[r]!;
			return { role: r, text: `найслабше в ${ROLE_NAME[v.weakest.whom]}: «${v.weakest.quote}» — ${v.weakest.why}. Взяти в ${ROLE_NAME[v.take.whom]}: ${v.take.what}. Здогадка: ${v.revised}` };
		});
	}

	private async positioningStep() {
		this.agent('strategist', 'thinking');
		const gpt = await this.maybeGpt('strategist', 'core');
		const out = normPositioning(await this.ask('strategist', 'core', prompt.positioning(this.reviewsText(), gpt), SCHEMA.positioning, () => fake.positioning(this.state.brief, !!gpt)));
		this.pos = { positioning: out.positioning, role: out.role, enemy: out.enemy };
		this.setElement('positioning', out.positioning, [`Роль бренду: ${out.role}`, `Ворог: ${out.enemy}`], { rejected: out.rejected.map((c) => ({ text: c.text, reason: c.reason })) });
		this.say('strategist', out.thought);
		this.agent('strategist', 'done');
	}

	private async namingStep() {
		this.agent('copywriter', 'thinking');
		const gpt = await this.maybeGpt('copywriter', 'core');
		const out = normNaming(await this.ask('copywriter', 'core', prompt.creative('copywriter', this.pos, gpt), SCHEMA.naming, () => fake.naming(!!gpt)));
		this.setElement('name', out.name.text, [out.name.reason].filter(Boolean), { rejected: out.names.map((c) => ({ text: c.text, reason: c.reason })) });
		this.setElement('slogan', out.slogan.text, [out.slogan.reason].filter(Boolean), { rejected: out.slogans.map((c) => ({ text: c.text, reason: c.reason })) });
		this.say('copywriter', out.thought);
		this.agent('copywriter', 'done');
	}

	private async logoStep() {
		this.agent('designer', 'thinking');
		const gpt = await this.maybeGpt('designer', 'core');
		const out = normLogo(await this.ask('designer', 'core', prompt.creative('designer', this.pos, gpt), SCHEMA.logo, () => fake.logo()));
		this.setElement('logo', out.concept, [], { logo: out.logo });
		this.say('designer', out.thought);
		this.agent('designer', 'done');
	}

	private pack(): string {
		const e = this.state.elements;
		const lines = CORE.map((id) => `- ${ELEMENT_TITLE[id]}: ${e[id]?.text ?? '—'}`);
		lines.splice(1, 0, `- Роль бренду: ${this.pos.role}; ворог: ${this.pos.enemy}`);
		const asks = this.state.verdicts.filter((v) => v.stage === 'core').flatMap((v) => v.demands.map((d) => `${ELEMENT_TITLE[d.element]} — ${d.demand}`));
		return lines.join('\n') + (asks.length ? `\nКлієнт по дорозі вимагав: ${asks.join('; ')}` : '');
	}

	private async contentStep(id: ContentElement) {
		const r = ELEMENT_OWNER[id];
		this.agent(r, 'thinking');
		const out = normContent(id, await this.ask(r, 'content', prompt.content(id, this.pack()), SCHEMA[id], () => fake.content(id)));
		this.setElement(id, out.text, out.details);
		this.say(r, out.thought);
		this.agent(r, 'done');
	}

	private setElement(id: ElementId, text: string, details: string[], extra: Partial<ElementValue> = {}) {
		const prev = this.state.elements[id];
		this.state.elements = {
			...this.state.elements,
			[id]: { id, text, details, edited: prev?.edited ?? false, approved: false, clientReworks: prev?.clientReworks ?? 0, ...(prev?.rejected ? { rejected: prev.rejected } : {}), ...(prev?.logo ? { logo: prev.logo } : {}), ...extra }
		};
		this.emit();
	}

	private async rework(id: ElementId, from: 'гравець' | 'клієнт', ask: string) {
		const r = ELEMENT_OWNER[id];
		const current = this.state.elements[id];
		if (!current) return;
		this.agent(r, 'thinking');
		if (id === 'logo') {
			const out = normLogo(await this.ask(r, 'rework', prompt.rework(from, id, current, ask), SCHEMA.logo, () => fake.rework(id, ask)));
			this.setElement(id, out.concept || current.text, current.details, { logo: out.logo });
			this.say(r, out.thought);
		} else {
			const out = normRework(await this.ask(r, 'rework', prompt.rework(from, id, current, ask), SCHEMA.rework, () => fake.rework(id, ask)));
			this.setElement(id, out.text || current.text, out.details.length ? out.details : current.details);
			this.say(r, out.thought);
		}
		if (id === 'positioning') this.pos.positioning = this.state.elements.positioning!.text;
		this.agent(r, 'done');
	}

	/* ─────────── клієнт ─────────── */

	private async clientStage(stage: 'core' | 'content', ids: ElementId[]): Promise<boolean> {
		this.state.clientInOffice = true;
		this.phase(stage === 'core' ? 'client_core' : 'client_content', `${this.state.brief.client.name} дивиться роботу`);
		const v1 = await this.clientCall(stage, ids, 1);
		if (v1.verdict !== 'rework') {
			this.state.clientInOffice = false;
			return v1.verdict === 'ok';
		}

		this.phase(stage === 'core' ? 'rework_core' : 'rework_content', 'Переробляємо на вимогу клієнта');
		const byElement = new Map<ElementId, string[]>();
		for (const d of v1.demands) byElement.set(d.element, [...(byElement.get(d.element) ?? []), d.demand]);
		await Promise.all([...byElement].map(async ([id, asks]) => {
			await this.rework(id, 'клієнт', asks.join('; '));
			const e = this.state.elements[id];
			if (e) this.setElement(id, e.text, e.details, { clientReworks: e.clientReworks + 1 });
			this.tire(ELEMENT_OWNER[id], 6);
		}));

		this.phase(stage === 'core' ? 'client_core' : 'client_content', `${this.state.brief.client.name} дивиться правки`);
		const v2 = await this.clientCall(stage, ids, 2);
		this.state.clientInOffice = false;
		return v2.verdict === 'ok';
	}

	private async clientCall(stage: 'core' | 'content', ids: ElementId[], round: number): Promise<ClientVerdict> {
		const items = ids.map((id) => this.state.elements[id]).filter((e): e is ElementValue => !!e);
		const res = await this.call({
			purpose: 'client', who: 'client', model: this.deps.models.client,
			system: CLIENT_CARD.replace('{archetype}', this.state.brief.client.archetype),
			messages: [{ role: 'user', content: prompt.client(this.state.brief, items, round, CLIENT_ROUND2) + guide(SCHEMA.client) }],
			schema: SCHEMA.client, fake: () => fake.client(round, stage)
		});
		const c = normClient(parseJson(res.text), ids, round);
		const v: ClientVerdict = { stage, round, ...c };
		this.state.verdicts = [...this.state.verdicts, v];
		this.say('client', c.reaction, 'client');
		const word = c.verdict === 'ok' ? 'приймає' : c.verdict === 'reject' ? 'відмовляється' : 'хоче правок';
		this.note(`Клієнт ${word}${c.demands.length ? ': ' + c.demands.map((d) => `${ELEMENT_TITLE[d.element]} — ${d.demand}`).join('; ') : ''}`);
		return v;
	}

	/* ─────────── гравець ─────────── */

	private waitPlayer(): Promise<void> {
		return new Promise((resolve) => {
			this.waiter = resolve;
		});
	}

	private playerIds(): ElementId[] {
		return this.state.phase === 'player_core' ? CORE : this.state.phase === 'player_content' ? CONTENT : [];
	}

	editsLeft(): ElementId[] {
		return this.playerIds().filter((id) => !this.edited.has(id));
	}

	/** Одна правка на елемент. Повертає текст помилки або null. */
	async edit(id: ElementId, comment: string): Promise<string | null> {
		const text = comment.trim();
		if (!this.playerIds().includes(id)) return 'Зараз цей елемент не правиться.';
		if (this.busy) return 'Команда ще переробляє попередню правку.';
		if (this.edited.has(id)) return 'Правку на цей елемент уже використано.';
		if (!text) return 'Напиши, що змінити.';
		if (text.length > EDIT_MAX) return `Коротше, до ${EDIT_MAX} знаків.`;
		this.edited.add(id);
		this.busy = true;
		const owner = ELEMENT_OWNER[id];
		this.state.status = `${ROLE_NAME[owner]} переробляє: ${ELEMENT_TITLE[id].toLowerCase()}`;
		this.note(`Твоя правка до «${ELEMENT_TITLE[id]}»: ${text}`);
		try {
			await this.rework(id, 'гравець', text);
			this.tire(owner, 4);
			const e = this.state.elements[id];
			if (e) this.setElement(id, e.text, e.details, { edited: true });
			return null;
		} catch (e) {
			if (isAbortError(e)) return 'Бриф закрито.';
			this.edited.delete(id);
			return humanError(e);
		} finally {
			this.busy = false;
			this.state.status = this.state.phase === 'player_core' ? 'Твоє слово: затверди або дай по одній правці на елемент' : 'Твоє слово по контенту: по одній правці на елемент';
			this.emit();
		}
	}

	approve(id: ElementId): string | null {
		const e = this.state.elements[id];
		if (!e || !this.playerIds().includes(id)) return 'Зараз цей елемент не затверджується.';
		this.setElement(id, e.text, e.details, { approved: !e.approved });
		return null;
	}

	submit(): string | null {
		if (!this.waiter) return 'Зараз нема чого показувати клієнту.';
		if (this.busy) return 'Зачекай, команда ще переробляє.';
		const w = this.waiter;
		this.waiter = null;
		w();
		return null;
	}

	/** Кинути бриф: команда втомилась даремно, репутація трохи падає. Після збою — без штрафу. */
	drop() {
		if (this.state.phase === 'done') return;
		const failed = this.state.phase === 'failed';
		this.abort.abort();
		this.waiter = null;
		this.finish('dropped', failed);
	}

	/* ─────────── фінал ─────────── */

	private finish(verdict: 'ok' | 'reject' | 'dropped', free = false) {
		const elements = Object.values(this.state.elements).filter((e): e is ElementValue => !!e);
		const { quality, notes, performanceHits } = qualityOf(elements);
		const last = this.state.verdicts.at(-1);
		const fee = this.state.brief.fee;
		let paid = 0;
		if (verdict === 'ok') paid = Math.round((fee * (0.6 + ((last?.mood ?? 50) / 100) * 0.6)) / 100) * 100;
		else if (verdict === 'reject' && this.coreAccepted) paid = Math.round((fee * 0.4) / 100) * 100;
		if (verdict === 'reject') for (const r of ROLES) this.tire(r, 10);

		const repDelta = free ? 0 : reputationDelta(quality, verdict);
		const result: RunResult = {
			verdict,
			paid,
			repDelta,
			quality,
			notes: [
				...notes.filter((n) => !n.ok).map((n) => `${ELEMENT_TITLE[n.element]}: ${n.text}`),
				...(performanceHits ? ['Клієнт протягнув перфоманс-штампи — індустрія це бачить.'] : []),
				...(verdict === 'reject' && this.coreAccepted ? ['Айдентику клієнт оплатив частково, від контенту відмовився.'] : [])
			],
			burnoutDelta: { ...this.burnoutDelta }
		};
		this.state.result = result;
		this.state.clientInOffice = false;
		for (const r of ROLES) {
			this.state.agents[r].status = this.burnoutOf(r) >= 85 ? 'tired' : 'idle';
			this.state.agents[r].spot = 'coffee';
		}
		const word = verdict === 'ok' ? 'Клієнт заплатив' : verdict === 'reject' ? 'Клієнт пішов' : 'Бриф закрито';
		this.phase('done', `${word}: +${paid.toLocaleString('uk-UA')} ₴, репутація ${repDelta >= 0 ? '+' : ''}${repDelta}`);
		this.deps.onFinish?.(this);
	}
}

export type { CoreElement };
