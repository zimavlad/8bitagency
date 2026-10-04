import type Anthropic from '@anthropic-ai/sdk';
import { normalizeLogo } from '$lib/logo';
import { ELEMENT_TITLE, ROLE_NAME, type Brief, type ContentElement, type ElementId, type ElementValue, type LogoSpec, type NamingOption, type Role } from '$lib/types';
import type { RequestParams } from '../model/client';

/* ───────────────────────── запит ───────────────────────── */

export type Msg = Anthropic.MessageParam;

/**
 * Описи полів (description) у JSON-схемі на моделях 5.5 провокують відмову класифікатора
 * (stop_reason refusal з порожньою відповіддю) — перевірено на живому API 04.10.2026.
 * Тому в API йде схема без описів, а підказка про поля — звичайним текстом у запиті (guide).
 */
export function bare(schema: unknown): unknown {
	if (Array.isArray(schema)) return schema.map(bare);
	if (!schema || typeof schema !== 'object') return schema;
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(schema)) if (k !== 'description') out[k] = bare(v);
	return out;
}

/** Текстова підказка про поля відповіді зі схеми. */
export function guide(schema: Record<string, unknown>): string {
	const lines: string[] = [];
	const walk = (o: Record<string, unknown>, path: string) => {
		const props = (o.properties ?? {}) as Record<string, Record<string, unknown>>;
		for (const [k, v] of Object.entries(props)) {
			const name = path ? `${path}.${k}` : k;
			const items = v.items as Record<string, unknown> | undefined;
			const d = [v.description, items?.description].filter(Boolean).join('; ');
			const en = (v.enum as string[] | undefined) ?? (items?.enum as string[] | undefined);
			if (d || en) lines.push(`- ${name}: ${d}${en ? `${d ? ' ' : ''}(${en.join(' | ')})` : ''}`);
			if (v.type === 'object') walk(v, name);
			if (items?.type === 'object') walk(items, `${name}[]`);
		}
	};
	walk(schema, '');
	return lines.length ? `\n\nПоля відповіді:\n${lines.join('\n')}` : '';
}

/** Один формат запиту для всіх кроків: системна картка в кеші, історія тільки дописується, JSON за схемою. */
export function request(o: { model: string; system: string; messages: Msg[]; schema: Record<string, unknown>; maxTokens?: number }): RequestParams {
	const haiku = o.model.startsWith('claude-haiku');
	return {
		model: o.model,
		max_tokens: o.maxTokens ?? 4000,
		system: [{ type: 'text', text: o.system, cache_control: { type: 'ephemeral' } }],
		messages: o.messages,
		...(haiku ? {} : { thinking: { type: 'adaptive' } }),
		output_config: { ...(haiku ? {} : { effort: 'low' }), format: { type: 'json_schema', schema: bare(o.schema) } }
	} as RequestParams;
}

export function parseJson(text: string): Record<string, unknown> {
	const a = text.indexOf('{');
	const b = text.lastIndexOf('}');
	if (a < 0 || b <= a) throw new StepError('відповідь не в тому форматі');
	try {
		return JSON.parse(text.slice(a, b + 1)) as Record<string, unknown>;
	} catch {
		throw new StepError('відповідь не в тому форматі');
	}
}

export class StepError extends Error {
	name = 'StepError';
}

/* ───────────────────────── схеми ───────────────────────── */

const str = (v: unknown, max = 400): string => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown, n: number, max = 200): string[] => arr(v).map((x) => str(x, max)).filter(Boolean).slice(0, n);

const S = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const list = (items: unknown, description?: string) => ({ type: 'array', items, ...(description ? { description } : {}) });

const THOUGHT = S('репліка в баблі, до 90 знаків');
const N = { type: 'number' };
const FILL = { type: 'string', enum: ['a', 'b'] };
const kind = (t: string) => ({ type: 'string', enum: [t] });
/** Кожна фігура — свій набір обовʼязкових полів: інакше модель «забуває» радіус і знак виходить порожнім. */
const SHAPE = {
	circle: obj({ type: kind('circle'), fill: FILL, cx: N, cy: N, r: N }),
	rect: obj({ type: kind('rect'), fill: FILL, x: N, y: N, w: N, h: N, r: N }),
	ellipse: obj({ type: kind('ellipse'), fill: FILL, cx: N, cy: N, rx: N, ry: N }),
	polygon: obj({ type: kind('polygon'), fill: FILL, points: list(N) })
};
const VERDICT = { type: 'string', enum: ['keep', 'rejected'] };

export const SCHEMA = {
	read: obj({
		thought: THOUGHT,
		problem: S('людська проблема за бізнесовою, одне речення до 16 слів'),
		insight: S('інсайт у форматі «X — це Y», до 14 слів'),
		advantage: S('що в цьому бізнесі унікальне й важливе для людей, до 14 слів'),
		direction: S('напрям для команди: «Показати, що X — це Y», до 14 слів'),
		gpt_take: S('що взяла з поради Джіпітенка, до 12 слів; порожньо, якщо не питала')
	}),
	huddle: obj({
		thought: THOUGHT,
		verdict: { type: 'string', enum: ['ok', 'doubt'] },
		note: S('що бачиш зі свого боку або в чому сумнів, до 16 слів')
	}),
	positioning: obj({
		thought: THOUGHT,
		candidates: list(obj({ text: S('позиціонування, одне речення до 22 слів'), verdict: VERDICT, reason: S('чому, до 10 слів') }), 'рівно 3, один keep'),
		role: S('роль бренду, 1–2 слова'),
		enemy: S('ворог бренду, 1–2 слова')
	}),
	naming: obj({
		thought: THOUGHT,
		options: list(obj({ name: S('назва, 1–2 слова'), slogan: S('слоган до 6 слів'), why: S('чому працює, до 10 слів') }), 'рівно 3 різні варіанти'),
		gpt_take: S('що взяв з поради Джіпітенка, до 12 слів; порожньо, якщо не питав')
	}),
	logo: obj({
		thought: THOUGHT,
		concept: S('ідея знака, одне речення до 16 слів'),
		palette: obj({ a: S('колір головної форми, hex #rrggbb'), b: S('другий колір, hex #rrggbb'), bg: S('тло плитки знака, hex #rrggbb; має контрастувати з a і b') }),
		shapes: list({ anyOf: [SHAPE.circle, SHAPE.rect, SHAPE.ellipse, SHAPE.polygon] }, 'від 2 до 6 фігур на полотні 100×100, по порядку знизу вгору; кожна фігура видима (радіус і розміри не менше 6)')
	}),
	/** Узгоджена переробка: стратегиня вирішує, чи міняти позиціонування. */
	reposition: obj({
		thought: THOUGHT,
		changed: { type: 'boolean' },
		positioning: S('нове або те саме позиціонування, одне речення до 22 слів'),
		role: S('роль бренду, 1–2 слова'),
		enemy: S('ворог бренду, 1–2 слова'),
		why: S('що змінила і чому, до 14 слів')
	}),
	rename: obj({
		thought: THOUGHT,
		changed: { type: 'boolean' },
		name: S('назва, 1–2 слова'),
		slogan: S('слоган до 6 слів'),
		why: S('що змінив і чому, до 14 слів')
	}),
	threads: obj({ thought: THOUGHT, voice: S('голос бренду одним реченням до 12 слів'), posts: list(S('пост для Threads до 120 знаків'), 'рівно 2') }),
	instagram: obj({ thought: THOUGHT, headline: S('заголовок на банері, до 6 слів'), visual: S('що на картинці, до 16 слів') }),
	reels: obj({ thought: THOUGHT, hooks: list(S('ідея Reels одним рядком до 12 слів'), 'рівно 3') }),
	youtube: obj({ thought: THOUGHT, title: S('назва ролика до 5 слів'), cover: S('що на обкладинці ролика, одне речення до 14 слів'), scenes: list(S('сцена до 10 слів'), 'рівно 3') }),
	gpt: obj({ answer: S('порада до 300 знаків'), source: S('назва файлу з бази або «загальні знання»') }),
	client: obj({
		lines: list(S('коротка репліка вголос до 60 знаків: жарт-доїбка або похвала про конкретну річ з роботи'), 'рівно 3, від найголовнішого'),
		reaction: S('підсумок одним-двома реченнями'),
		verdict: { type: 'string', enum: ['ok', 'rework', 'reject'] },
		mood: { type: 'integer' },
		demands: list(S('вимога до 12 слів'), 'до 3, якщо rework')
	}),
	persona: obj({
		name: S('як звертаються до власника чи власниці'),
		gender: { type: 'string', enum: ['m', 'f'] },
		look: { type: 'string', enum: ['leather', 'suit', 'casual', 'creative', 'farmer', 'sport'] },
		archetype: S('характер одним реченням'),
		voice: S('манера говорити, 2–4 маркери')
	})
} as const;

/* ───────────────────────── тексти запитів ───────────────────────── */

export function briefBlock(b: Brief): string {
	return `Клієнт: ${b.client.name}, ${b.client.business}.\nБриф дослівно:\n«${b.text}»`;
}

const advice = (a?: string) => (a ? `\n\nТи спитав(ла) Джіпітенка, він порадив:\n«${a}»\nВізьми одну корисну деталь або відкинь — скажи в gpt_take.` : '');

export interface Read { thought: string; problem: string; insight: string; advantage: string; direction: string; gptTake: string }
export const readText = (r: Read) => `Проблема: ${r.problem}\nІнсайт: ${r.insight}\nПеревага: ${r.advantage}\nНапрям: ${r.direction}`;

export const prompt = {
	read: (b: Brief, gpt?: string) =>
		`Новий бриф.\n${briefBlock(b)}\n\nПройди Four Points: проблема → інсайт «X — це Y» → перевага → напрям «Показати, що X — це Y». Коротко й конкретно про цей бізнес.${advice(gpt)}`,

	huddle: (role: Role, b: Brief, read: Read) =>
		`${briefBlock(b)}\n\nСтратегиня кличе тебе порадитись перед позиціонуванням. Її розбір:\n${readText(read)}\n\n` +
		(role === 'copywriter'
			? 'Подивись як копірайтер: чи з цього вийде назва і слоган, які люди запамʼятають? Скажи «ok» або «doubt» і коротко чому.'
			: 'Подивись як дизайнер: чи з цього вийде одна сильна форма-знак? Скажи «ok» або «doubt» і коротко чому.'),

	positioning: (notes: { role: Role; text: string }[], gpt?: string) =>
		`Колеги відповіли:\n${notes.map((n) => `${ROLE_NAME[n.role]}: ${n.text}`).join('\n')}\n\n` +
		`Сформулюй позиціонування. 3 кандидати: рівно один keep, два rejected з причиною. Додай роль бренду і ворога.${advice(gpt)}`,

	naming: (pos: Pos, gpt?: string) =>
		`Стратегиня визначила позиціонування:\n«${pos.positioning}»\nРоль бренду: ${pos.role}. Ворог: ${pos.enemy}.\n\n` +
		`Дай 3 різні варіанти «назва + слоган» — різними прийомами. Керівник агенції обере один перед показом клієнту.${advice(gpt)}`,

	logo: (pos: Pos, name: string, slogan: string) =>
		`Позиціонування: «${pos.positioning}». Роль бренду: ${pos.role}. Ворог: ${pos.enemy}.\nОбрана назва: «${name}». Слоган: «${slogan}».\n\nНамалюй знак під цю назву: одна сильна форма, два кольори на контрастному тлі, від 2 до 6 фігур, без тексту. Знак показуємо піксельним 32×32, тож дрібні деталі зникнуть — форма має бути крупна й проста.`,

	/** Узгоджена переробка основи: правки гравця або клієнта, кожен вирішує свою частину. */
	reposition: (who: 'керівник агенції' | 'клієнт', notes: string[], cur: Pos) =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`Поточне позиціонування: «${cur.positioning}». Роль: ${cur.role}. Ворог: ${cur.enemy}.\n` +
		`Вирішуй як стратегиня: якщо правки стосуються суті — зміни позиціонування (changed: true), якщо ні — лиши як є (changed: false).` +
		(who === 'клієнт' ? ' Клієнт не розуміється на брендингу: врахуй, чого він насправді боїться, але не перетворюй позиціонування на рекламу знижок.' : ''),

	rename: (who: 'керівник агенції' | 'клієнт', notes: string[], pos: Pos, posChanged: boolean, name: string, slogan: string) =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`${posChanged ? 'Стратегиня змінила позиціонування' : 'Позиціонування лишилось'}: «${pos.positioning}». Роль: ${pos.role}. Ворог: ${pos.enemy}.\n` +
		`Поточні назва «${name}» і слоган «${slogan}». Якщо правки чи нове позиціонування цього вимагають — зміни (changed: true), інакше лиши (changed: false).`,

	relogo: (who: 'керівник агенції' | 'клієнт', notes: string[], pos: Pos, name: string) =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`Позиціонування: «${pos.positioning}». Назва: «${name}».\nПеремалюй знак з урахуванням правок і назви. Якщо правки не про знак — лиши ту саму форму, можна уточнити кольори. Знак піксельний 32×32: крупна проста форма, від 2 до 6 видимих фігур.`,

	content: (id: ContentElement, pack: string) => `Клієнт затвердив основу:\n${pack}\n\nТепер ${CONTENT_TASK[id]} Дуже коротко, без пояснень.`,

	recontent: (id: ContentElement, who: 'керівник агенції' | 'клієнт', notes: string[], cur: ElementValue) =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки до каналів:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`Твоя поточна версія «${ELEMENT_TITLE[id]}»:\n${[cur.text, ...cur.details].join('\n')}\n\nПерероби з урахуванням правок, що стосуються саме цього каналу; решту лиши. Так само коротко.`,

	gpt: (role: Role, question: string, chunks: { source: string; text: string }[]) =>
		`${ROLE_NAME[role]} питає: ${question}\n\n` +
		(chunks.length ? `Уривки з бази знань:\n${chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.text}`).join('\n\n')}` : 'Уривків з бази знань нема.'),

	client: (items: ElementValue[], round: number, last: boolean, extra?: string) =>
		'Спершу скажи 3 короткі репліки вголос (lines): про конкретні речі з того, що бачиш, твоїми словами — жартом або доїбкою, якщо не подобається, похвалою, якщо подобається. Потім підсумок і рішення.\n\n' +
		`Агенція показує${round > 1 ? ` (коло ${round}, після твоїх правок)` : ''}:\n${items.map((e) => `- ${ELEMENT_TITLE[e.id]}: ${e.text}${e.details.length ? ' (' + e.details.slice(0, 4).join('; ') + ')' : ''}`).join('\n')}` +
		(extra ? `\n\n${extra}` : '') +
		(last ? '\n\nЦе остання подивка: або "ok", або "reject".' : ''),

	persona: (text: string) => `Бриф:\n«${text}»`
};

export interface Pos { positioning: string; role: string; enemy: string }

const CONTENT_TASK: Record<ContentElement, string> = {
	threads: 'голос бренду для Threads одним реченням і 2 пости (до 120 знаків).',
	instagram: 'банер для Instagram: заголовок до 6 слів і що на картинці одним реченням.',
	reels: '3 ідеї для Reels — по одному рядку до 12 слів.',
	youtube: 'дорогий іміджевий ролик для YouTube: назва, що на обкладинці (одна сцена, яку видно з першого погляду), і 3 сцени по одному рядку до 10 слів.'
};

export const GPT_QUESTION = {
	read: (role: Role, b: Brief) =>
		role === 'strategist' ? `що зараз відбувається в категорії «${b.client.business}» і що всі в ній обіцяють?` : `які слова й кліше використовують у категорії «${b.client.business}»?`,
	naming: (b: Brief) => `приклади сильних назв і слоганів у категорії «${b.client.business}»`
};

/** Наскільки кожен любить бігати до Джіпітенка. */
export const GPT_HABIT: Record<Role, number> = { strategist: 0.45, copywriter: 0.75, designer: 0.05 };

/* ───────────────────────── нормалізація ───────────────────────── */

export function normRead(j: Record<string, unknown>): Read {
	const r = { thought: str(j.thought, 120), problem: str(j.problem, 200), insight: str(j.insight, 200), advantage: str(j.advantage, 200), direction: str(j.direction, 200), gptTake: str(j.gpt_take, 160) };
	if (!r.insight && !r.direction) throw new StepError('стратегиня не дала розбір');
	return r;
}

export function normHuddle(j: Record<string, unknown>) {
	return { thought: str(j.thought, 120), ok: j.verdict !== 'doubt', note: str(j.note, 200) };
}

export function normPositioning(j: Record<string, unknown>) {
	const c = arr(j.candidates).slice(0, 3).map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { text: str(o.text, 300), keep: o.verdict === 'keep', reason: str(o.reason, 120) }; }).filter((x) => x.text);
	if (!c.length) throw new StepError('стратегиня не дала позиціонування');
	const keep = c.find((x) => x.keep) ?? c[0];
	return { thought: str(j.thought, 120), positioning: keep.text, why: keep.reason, rejected: c.filter((x) => x !== keep).map((x) => ({ text: x.text, reason: x.reason })), role: str(j.role, 40), enemy: str(j.enemy, 40) };
}

export function normNaming(j: Record<string, unknown>): { thought: string; options: NamingOption[]; gptTake: string } {
	const options = arr(j.options).slice(0, 3).map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { name: str(o.name, 60), slogan: str(o.slogan, 120), why: str(o.why, 120) }; }).filter((o) => o.name && o.slogan);
	if (!options.length) throw new StepError('копірайтер не дав назву');
	return { thought: str(j.thought, 120), options, gptTake: str(j.gpt_take, 160) };
}

export function normLogo(j: Record<string, unknown>): { thought: string; concept: string; logo: LogoSpec } {
	const logo = normalizeLogo(j);
	if (!logo || logo.shapes.length < 2) throw new StepError('дизайнер не намалював знак');
	return { thought: str(j.thought, 120), concept: str(j.concept, 200), logo };
}

export function normReposition(j: Record<string, unknown>, cur: Pos) {
	const changed = j.changed === true && !!str(j.positioning);
	return { thought: str(j.thought, 120), changed, pos: changed ? { positioning: str(j.positioning, 300), role: str(j.role, 40) || cur.role, enemy: str(j.enemy, 40) || cur.enemy } : cur, why: str(j.why, 160) };
}

export function normRename(j: Record<string, unknown>, name: string, slogan: string) {
	const changed = j.changed === true && !!str(j.name);
	return { thought: str(j.thought, 120), changed, name: changed ? str(j.name, 60) : name, slogan: changed ? str(j.slogan, 120) || slogan : slogan, why: str(j.why, 160) };
}

export function normContent(id: ContentElement, j: Record<string, unknown>): { thought: string; text: string; details: string[] } {
	const thought = str(j.thought, 120);
	switch (id) {
		case 'threads':
			return { thought, text: str(j.voice, 160), details: strs(j.posts, 2, 160) };
		case 'instagram':
			return { thought, text: str(j.headline, 80), details: [str(j.visual, 200)].filter(Boolean) };
		case 'reels':
			return { thought, text: 'Три ідеї', details: strs(j.hooks, 3, 140) };
		case 'youtube':
			return { thought, text: str(j.title, 80), details: [str(j.cover, 160), ...strs(j.scenes, 3, 120)].filter(Boolean) };
	}
}

export function normGpt(j: Record<string, unknown>) {
	return { answer: str(j.answer, 350), source: str(j.source, 80) };
}

export function normClient(j: Record<string, unknown>, last: boolean) {
	let verdict: 'ok' | 'rework' | 'reject' = j.verdict === 'ok' || j.verdict === 'reject' ? j.verdict : 'rework';
	const demands = strs(j.demands, 3, 160);
	if (last && verdict === 'rework') verdict = 'reject';
	if (verdict === 'rework' && !demands.length) verdict = 'ok';
	const mood = Math.max(0, Math.min(100, Math.round(Number(j.mood) || 50)));
	const lines = strs(j.lines, 3, 90);
	return { reaction: str(j.reaction, 300), lines: lines.length ? lines : [str(j.reaction, 90)].filter(Boolean), verdict, mood, demands: verdict === 'rework' ? demands : [] };
}

export function normPersona(j: Record<string, unknown>) {
	const looks = ['leather', 'suit', 'casual', 'creative', 'farmer', 'sport'] as const;
	return {
		name: str(j.name, 40) || 'Замовник',
		gender: j.gender === 'f' ? ('f' as const) : ('m' as const),
		look: (looks as readonly string[]).includes(String(j.look)) ? (j.look as (typeof looks)[number]) : ('casual' as const),
		archetype: str(j.archetype, 200),
		voice: str(j.voice, 120)
	};
}

export type { ElementId };
