import type Anthropic from '@anthropic-ai/sdk';
import { normalizeLogo } from '$lib/logo';
import { CONTENT, ELEMENT_TITLE, ROLE_NAME, type Brief, type ContentElement, type ElementId, type ElementValue, type LogoSpec, type Role } from '$lib/types';
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
			const d = [v.description, (v.items as Record<string, unknown> | undefined)?.description].filter(Boolean).join('; ');
			const en = (v.enum as string[] | undefined) ?? ((v.items as Record<string, unknown> | undefined)?.enum as string[] | undefined);
			if (d || en) lines.push(`- ${name}: ${d}${en ? `${d ? ' ' : ''}(${en.join(' | ')})` : ''}`);
			if (v.type === 'object') walk(v, name);
			const it = v.items as Record<string, unknown> | undefined;
			if (it?.type === 'object') walk(it, `${name}[]`);
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

/** JSON з відповіді; модель інколи обгортає його текстом. */
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

const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown, n: number, max = 300): string[] => arr(v).map((x) => str(x, max)).filter(Boolean).slice(0, n);

const S = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const obj = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const list = (items: unknown, description?: string) => ({ type: 'array', items, ...(description ? { description } : {}) });

const THOUGHT = S('думка вголос для бабла, до 160 знаків');
const ROLE_ENUM = { type: 'string', enum: ['strategist', 'copywriter', 'designer'] };

/* ───────────────────────── схеми ───────────────────────── */

export const SCHEMA = {
	read: obj({ thought: THOUGHT, observations: list(S('спостереження про бриф'), '2–3 пункти'), cliches: list(S('кліше категорії'), '1–3'), hunch: S('здогадка: де напруга'), gpt_take: S('що взяв або відкинув з поради Джіпітенка; порожньо, якщо не питав') }),
	review: obj({ thought: THOUGHT, weakest: obj({ whom: ROLE_ENUM, quote: S('дослівний фрагмент з тексту колеги'), why: S('чому це слабко') }), take: obj({ whom: ROLE_ENUM, what: S('що варто взяти в колеги') }), revised: S('оновлена здогадка') }),
	positioning: obj({ thought: THOUGHT, candidates: list(obj({ text: S('позиціонування, одне речення'), verdict: { type: 'string', enum: ['keep', 'rejected'] }, reason: S('чому') }), 'рівно 3, один keep'), role: S('роль бренду, 1–2 слова'), enemy: S('ворог бренду, 1–2 слова'), gpt_take: S('що взяла з поради Джіпітенка; порожньо, якщо не питала') }),
	naming: obj({ thought: THOUGHT, names: list(obj({ text: S('назва'), verdict: { type: 'string', enum: ['keep', 'rejected'] }, reason: S('чому') }), 'рівно 3, один keep'), slogans: list(obj({ text: S('слоган'), technique: S('прийом: твердження, контраст, запитання, команда, ідентифікація'), verdict: { type: 'string', enum: ['keep', 'rejected'] }, reason: S('чому') }), 'рівно 3 різними прийомами, один keep'), gpt_take: S('що взяв з поради Джіпітенка; порожньо, якщо не питав') }),
	logo: obj({
		thought: THOUGHT,
		concept: S('ідея знака, 1–2 речення'),
		palette: obj({ a: S('основний колір, hex #rrggbb'), b: S('другий колір, hex #rrggbb') }),
		shapes: list(
			obj(
				{
					type: { type: 'string', enum: ['rect', 'circle', 'ellipse', 'polygon', 'path'] },
					fill: { type: 'string', enum: ['a', 'b'] },
					x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' }, r: { type: 'number' },
					cx: { type: 'number' }, cy: { type: 'number' }, rx: { type: 'number' }, ry: { type: 'number' },
					points: list({ type: 'number' }), d: S('контур path, лише команди й числа')
				},
				['type', 'fill']
			),
			'до 8 фігур на полотні 100×100'
		)
	}),
	rework: obj({ thought: THOUGHT, text: S('нова версія елемента'), details: list(S('додаткові рядки, якщо потрібні')) }),
	threads: obj({ thought: THOUGHT, summary: S('tone of voice одним реченням'), principles: list(S('принцип голосу'), '3'), posts: list(S('приклад посту для Threads'), '2') }),
	instagram: obj({ thought: THOUGHT, headline: S('заголовок на креативі'), visual: S('що на картинці'), caption: S('підпис до посту') }),
	reels: obj({ thought: THOUGHT, idea: S('загальна ідея рубрики'), items: list(obj({ hook: S('перші 2 секунди'), scenario: S('що відбувається') }), '3') }),
	youtube: obj({ thought: THOUGHT, title: S('назва ролика'), concept: S('ідея іміджевого ролика'), beats: list(S('сцена'), '4') }),
	gpt: obj({ answer: S('порада, до 400 знаків'), tips: list(S('коротка порада'), 'до 3'), source: S('назва файлу з бази або «загальні знання»') }),
	client: obj({
		reaction: S('що клієнт каже вголос, 1–3 речення'),
		verdict: { type: 'string', enum: ['ok', 'rework', 'reject'] },
		mood: { type: 'integer', description: 'настрій 0..100' },
		demands: list(obj({ element: { type: 'string', enum: ['positioning', 'name', 'slogan', 'logo', ...CONTENT] }, demand: S('конкретна вимога') }), 'вимоги, якщо rework')
	})
} as const;

/* ───────────────────────── тексти запитів ───────────────────────── */

const LENS: Record<Role, string> = {
	strategist: 'правду бренду і культурну правду: що бізнес робить насправді і що зараз відбувається з людьми навколо категорії',
	copywriter: 'правду людини: як говорить аудиторія і чого вона не скаже вголос; і словесні кліше категорії',
	designer: 'правду категорії: візуальні коди й кольори, які в цій категорії повторюють усі'
};

export function briefBlock(b: Brief): string {
	return `Клієнт: ${b.client.name}, ${b.client.business}.\nБриф дослівно:\n«${b.text}»`;
}

const advice = (a?: string) => (a ? `\n\nТи спитав(ла) Джіпітенка, він порадив:\n«${a}»\nВізьми корисне або відкинь — коротко скажи в полі gpt_take.` : '');

export const prompt = {
	read: (role: Role, b: Brief, gpt?: string) =>
		`Новий бриф.\n${briefBlock(b)}\n\nРозбери його через свою лінзу — ${LENS[role]}. Колег ще не чув(ла).${advice(gpt)}`,

	review: (role: Role, peers: { role: Role; text: string }[]) =>
		`Колеги прочитали бриф так:\n\n${peers.map((p) => `${ROLE_NAME[p.role]} (${p.role}):\n${p.text}`).join('\n\n')}\n\n` +
		`Назви найслабше місце в одного з колег — поле quote має бути дослівним фрагментом з його тексту. ` +
		`Скажи, що варто взяти в когось, і онови свою здогадку. Погоджуватись з усім не треба: спільна думка трьох — не доказ.`,

	positioning: (reviews: { role: Role; text: string }[], gpt?: string) =>
		`Рецензії команди:\n\n${reviews.map((r) => `${ROLE_NAME[r.role]}: ${r.text}`).join('\n\n')}\n\n` +
		`Сформулюй позиціонування на перетині правд. Дай 3 кандидати: рівно один keep, два rejected з причиною. ` +
		`Додай роль бренду і ворога.${advice(gpt)}`,

	creative: (role: 'copywriter' | 'designer', pos: { positioning: string; role: string; enemy: string }, gpt?: string) =>
		`Стратегиня визначила позиціонування:\n«${pos.positioning}»\nРоль бренду: ${pos.role}. Ворог: ${pos.enemy}.\n\n` +
		(role === 'copywriter'
			? 'Придумай назву (3 варіанти, один keep) і слоган (3 варіанти різними прийомами, один keep). Назва й слоган мають випливати з позиціонування.'
			: 'Намалюй знак: одна сильна форма, що несе роль бренду. Два кольори, до 8 фігур, без тексту.') +
		advice(gpt),

	rework: (from: 'гравець' | 'клієнт', id: ElementId, current: ElementValue, ask: string) =>
		`${from === 'гравець' ? 'Керівник агенції' : 'Клієнт'} просить переробити «${ELEMENT_TITLE[id]}»:\n«${ask}»\n\n` +
		`Поточна версія:\n${current.text}${current.details.length ? '\n' + current.details.join('\n') : ''}\n\n` +
		(id === 'logo' ? 'Перемалюй знак з урахуванням правки.' : 'Перероби лише цей елемент. У поле text — нова головна версія.') +
		(from === 'клієнт' ? ' Клієнт не розуміється на брендингу: врахуй вимогу, але не зламай суть, якщо можна.' : ''),

	content: (id: ContentElement, pack: string) =>
		`Клієнт затвердив основу:\n${pack}\n\nТепер ${CONTENT_TASK[id]}`,

	gpt: (role: Role, question: string, chunks: { source: string; text: string }[]) =>
		`${ROLE_NAME[role]} питає: ${question}\n\n` +
		(chunks.length ? `Уривки з бази знань:\n${chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.text}`).join('\n\n')}` : 'Уривків з бази знань нема.'),

	client: (b: Brief, items: ElementValue[], round: number, round2: string) =>
		`Твій бриф був:\n«${b.text}»\n\nАгенція показує:\n${items.map((e) => `- ${ELEMENT_TITLE[e.id]}: ${e.text}${e.details.length ? ' (' + e.details.slice(0, 3).join('; ') + ')' : ''}`).join('\n')}` +
		(round > 1 ? `\n\n${round2}` : '')
};

const CONTENT_TASK: Record<ContentElement, string> = {
	threads: 'опиши tone of voice бренду для Threads: одне речення-суть, 3 принципи голосу і 2 приклади постів.',
	instagram: 'придумай рекламний креатив для Instagram: заголовок на картинці, що на картинці, підпис.',
	reels: 'придумай рубрику Reels і 3 ідеї: хук перших двох секунд і що відбувається.',
	youtube: 'придумай дорогий іміджевий ролик для YouTube: назва, ідея і 4 сцени.'
};

export const GPT_QUESTION = {
	read: (role: Role, b: Brief) =>
		role === 'strategist' ? `що зараз відбувається в категорії «${b.client.business}» і що всі в ній обіцяють?`
			: role === 'copywriter' ? `які слова й кліше використовують у категорії «${b.client.business}»?`
				: `які візуальні коди в категорії «${b.client.business}»?`,
	core: (role: Role, b: Brief) =>
		role === 'strategist' ? `як зібрати позиціонування для «${b.client.business}», щоб не вийшло як у всіх?`
			: role === 'copywriter' ? `приклади сильних назв і слоганів у категорії «${b.client.business}»`
				: `який знак пасує бізнесу «${b.client.business}»?`
};

/** Наскільки кожен любить бігати до Джіпітенка. */
export const GPT_HABIT: Record<Role, number> = { strategist: 0.45, copywriter: 0.75, designer: 0.08 };

/* ───────────────────────── нормалізація ───────────────────────── */

export interface ReadOut { thought: string; observations: string[]; cliches: string[]; hunch: string; gptTake: string }
export function normRead(j: Record<string, unknown>): ReadOut {
	return { thought: str(j.thought, 200), observations: strs(j.observations, 3), cliches: strs(j.cliches, 3, 80), hunch: str(j.hunch, 300), gptTake: str(j.gpt_take, 200) };
}
export const readText = (r: ReadOut) => [...r.observations.map((o) => `- ${o}`), `Здогадка: ${r.hunch}`].join('\n');

export interface ReviewOut { thought: string; weakest: { whom: Role; quote: string; why: string }; take: { whom: Role; what: string }; revised: string }
const role = (v: unknown, fallback: Role): Role => (v === 'strategist' || v === 'copywriter' || v === 'designer' ? v : fallback);
export function normReview(j: Record<string, unknown>, self: Role): ReviewOut {
	const other: Role = self === 'strategist' ? 'copywriter' : 'strategist';
	const w = (j.weakest ?? {}) as Record<string, unknown>;
	const t = (j.take ?? {}) as Record<string, unknown>;
	return {
		thought: str(j.thought, 200),
		weakest: { whom: role(w.whom, other), quote: str(w.quote, 200), why: str(w.why, 300) },
		take: { whom: role(t.whom, other), what: str(t.what, 300) },
		revised: str(j.revised, 300)
	};
}

interface Cand { text: string; verdict: 'keep' | 'rejected'; reason: string }
function pickKeep(v: unknown, max: number): { keep: Cand; rejected: Cand[] } | null {
	const c: Cand[] = arr(v).slice(0, max).map((x) => {
		const o = (x ?? {}) as Record<string, unknown>;
		const technique = str(o.technique, 40);
		return { text: str(o.text, 300), verdict: o.verdict === 'keep' ? 'keep' : 'rejected', reason: (technique ? `${technique}. ` : '') + str(o.reason, 200) } as Cand;
	}).filter((x) => x.text);
	if (!c.length) return null;
	const keep = c.find((x) => x.verdict === 'keep') ?? c[0];
	return { keep, rejected: c.filter((x) => x !== keep) };
}

export function normPositioning(j: Record<string, unknown>) {
	const p = pickKeep(j.candidates, 3);
	if (!p) throw new StepError('стратегиня не дала позиціонування');
	return { thought: str(j.thought, 200), positioning: p.keep.text, rejected: p.rejected, role: str(j.role, 40), enemy: str(j.enemy, 40), gptTake: str(j.gpt_take, 200) };
}

export function normNaming(j: Record<string, unknown>) {
	const n = pickKeep(j.names, 3);
	const s = pickKeep(j.slogans, 3);
	if (!n || !s) throw new StepError('копірайтер не дав назву чи слоган');
	return { thought: str(j.thought, 200), name: n.keep, names: n.rejected, slogan: s.keep, slogans: s.rejected, gptTake: str(j.gpt_take, 200) };
}

export function normLogo(j: Record<string, unknown>): { thought: string; concept: string; logo: LogoSpec } {
	const logo = normalizeLogo(j);
	if (!logo) throw new StepError('дизайнер не намалював знак');
	return { thought: str(j.thought, 200), concept: str(j.concept, 300), logo };
}

export function normRework(j: Record<string, unknown>) {
	return { thought: str(j.thought, 200), text: str(j.text, 600), details: strs(j.details, 6) };
}

export function normContent(id: ContentElement, j: Record<string, unknown>): { thought: string; text: string; details: string[] } {
	const thought = str(j.thought, 200);
	switch (id) {
		case 'threads':
			return { thought, text: str(j.summary), details: [...strs(j.principles, 3).map((p) => `Принцип: ${p}`), ...strs(j.posts, 2).map((p) => `Пост: ${p}`)] };
		case 'instagram':
			return { thought, text: str(j.headline), details: [`Візуал: ${str(j.visual)}`, `Підпис: ${str(j.caption)}`] };
		case 'reels':
			return { thought, text: str(j.idea), details: arr(j.items).slice(0, 3).map((x) => { const o = (x ?? {}) as Record<string, unknown>; return `Хук: ${str(o.hook, 200)} → ${str(o.scenario, 300)}`; }) };
		case 'youtube':
			return { thought, text: str(j.title), details: [`Ідея: ${str(j.concept)}`, ...strs(j.beats, 4).map((b, i) => `Сцена ${i + 1}: ${b}`)] };
	}
}

export function normGpt(j: Record<string, unknown>) {
	return { answer: str(j.answer, 450), tips: strs(j.tips, 3, 160), source: str(j.source, 80) };
}

export function normClient(j: Record<string, unknown>, allowed: ElementId[], round: number) {
	let verdict: 'ok' | 'rework' | 'reject' = j.verdict === 'ok' || j.verdict === 'reject' ? j.verdict : 'rework';
	const demands = arr(j.demands)
		.map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { element: o.element as ElementId, demand: str(o.demand, 240) }; })
		.filter((d) => allowed.includes(d.element) && d.demand)
		.slice(0, 4);
	// Друга подивка: правок більше нема — бурчить і приймає, або відмовляє.
	if (round > 1 && verdict === 'rework') verdict = 'ok';
	if (verdict === 'rework' && !demands.length) verdict = 'ok';
	const mood = Math.max(0, Math.min(100, Math.round(Number(j.mood) || 50)));
	return { reaction: str(j.reaction, 400), verdict, mood, demands: verdict === 'rework' ? demands : [] };
}
