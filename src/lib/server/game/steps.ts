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

/**
 * Сміття, яке інколи видає модель: хвіст із десятків лапок (бачили в поясненні до назви) і ієрогліфи посеред
 * українського слова (бачили в пораді Джіпітенка). Прибираємо до показу гравцю.
 */
export function clean(s: string, lines = false): string {
	const t = s
		.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu, '')
		.replace(/(["“”„«»'`])\1{2,}/g, '')
		.replace(/(["“”„«»]\s*){3,}/g, '');
	// пости Threads тримають переноси: «ніхто: / абсолютно ніхто: / ми:» без них не працює
	return (lines ? t.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ')).trim();
}
const str = (v: unknown, max = 400): string => (typeof v === 'string' ? clean(v).slice(0, max) : '');
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
	idea: obj({
		thought: THOUGHT,
		idea: S('креативна ідея коротко, до 14 слів: назва ходу й суть'),
		how: list(S('як це виглядає в житті, до 12 слів, без соцмереж і реклами'), 'рівно 1'),
		why: S('чому це сміливо, до 8 слів')
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
		idea: S('креативна ідея до 14 слів: та сама або змінена під правки'),
		name: S('назва, 1–2 слова'),
		slogan: S('слоган до 6 слів'),
		why: S('що змінив і чому, до 14 слів')
	}),
	threads: obj({ thought: THOUGHT, voice: S('голос бренду одним реченням до 12 слів'), posts: list(S('пост для українського Threads до 120 знаків: всратий прикол як від живої людини, з маленької літери, без офіціозу; без хештегів, цін і «купуйте»'), 'рівно 3, кожен іншим форматом') }),
	instagram: obj({ thought: THOUGHT, headline: S('заголовок на банері, до 6 слів'), visual: S('що на картинці, до 16 слів') }),
	reels: obj({ thought: THOUGHT, hooks: list(S('ідея Reels до 24 слів: гачок у перші 2 секунди і прикол — перекручений мем-тренд з несподіваним фіналом або сміливий офлайн-челендж, знятий на телефон'), 'рівно 3, різні прийоми') }),
	youtube: obj({ thought: THOUGHT, title: S('назва ролика до 5 слів'), scenes: list(S('кадр до 14 слів: що в кадрі і що відбувається'), 'рівно 4, від гачка до фіналу з брендом') }),
	gpt: obj({ answer: S('порада до 200 знаків, без вступу і без запитань у відповідь'), source: S('назва файлу з бази або «загальні знання»') }),
	client: obj({
		lines: list(S('коротка репліка вголос до 60 знаків: жарт-доїбка або похвала про конкретну річ з роботи'), 'рівно 3, від найголовнішого'),
		reaction: S('підсумок одним-двома реченнями'),
		verdict: { type: 'string', enum: ['ok', 'rework', 'reject'] },
		mood: { type: 'integer' },
		demands: list(obj({ text: S('вимога до 14 слів'), kind: { type: 'string', enum: ['air', 'question', 'fear'], description: 'air — «повітря», question — тупе питання про сенс, fear — «серйозна» правка зі страху' } }), 'стільки, скільки сказано в завданні, якщо rework')
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
	return `Клієнт: ${b.client.name}, ${b.client.business}.\nБриф дослівно:\n«${b.text}»${b.budget ? `\nРекламний бюджет клієнта: ${b.budget.toLocaleString('uk-UA')} ₴.` : ''}`;
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

	/** Ще три варіанти, коли керівнику не сподобались попередні. */
	renaming: (rejected: string[]) =>
		`Керівник забракував усі варіанти:\n${rejected.map((r) => `- ${r}`).join('\n')}\n\nДай 3 нові, зовсім інші — іншими прийомами, сміливіше й смішніше, але по суті позиціонування. Не повторюй жодного слова з забракованих назв.`,

	/** Креативна ідея: навіть під серйозну стратегію — сміливий сучасний прикол, на якому стоїть уся реклама. */
	idea: (pos: Pos, read: Read, budget?: number) =>
		`Стратегиня визначила позиціонування:\n«${pos.positioning}»\nРоль бренду: ${pos.role}. Ворог: ${pos.enemy}.\nІнсайт: ${read.insight}\n\n` +
		`Придумай креативну ідею, на якій стоятиме вся реклама. Стратегія може бути серйозною — ідея навпаки сміла, смішна й сучасна: хід, про який напишуть у Threads, перешлють другу, а конкуренти позаздрять. ` +
		`Це може бути стьоб над конкурентом чи над собою, дивна акція з правилами, офлайн-прикол, колаба з несподіваним партнером, мем, якого ще нема. ` +
		`Деталі бери тільки з брифу і зі світу саме цих людей: що вони роблять, де, коли й чого бояться; мова — як в українських Threads і TikTok. Не тягни побутові штампи, яких нема в брифі. Горе й смерть не чіпай. ` +
		`Ідея — сам хід у реальному світі (що бренд робить, що людина бачить чи отримує), а не план постів: соцмережі, рілси, банери й ролик не згадуй, до каналів ще не дійшли. Коротко: суть до 14 слів. ` +
		`Ідея випливає з інсайту і здійсненна для цього бізнесу. ${budget ? `Рекламний бюджет ${budget.toLocaleString('uk-UA')} ₴: телевізор і білборди його зʼїдять за тиждень, тож ідея має розійтися сама, дешево.` : 'Грошей на рекламу майже нема: ідея має розійтися сама.'} ` +
		`Без пафосу, «цінностей» і соціальних роликів про любов. Перевір: чи хочеться розповісти про це другу? Якщо ні — думай далі.`,

	naming: (pos: Pos, gpt?: string, idea?: string) =>
		`Стратегиня визначила позиціонування:\n«${pos.positioning}»\nРоль бренду: ${pos.role}. Ворог: ${pos.enemy}.\n${idea ? `Креативна ідея: «${idea}». Назва і слоган грають з цією ідеєю.\n` : ''}\n` +
			`Дай 3 різні варіанти «назва + слоган» — різними прийомами. Керівник агенції обере один перед показом клієнту.\n` +
		`Планка: дотепно, з легким гумором і живою інтонацією, як сказав би розумний друг, а не банер. Без пафосу, «найкращий», «якість», «турбота», без канцеляриту й римованих гасел. Перевір кожен: людина посміхнеться і запамʼятає з першого разу? Хотілося б сказати цю назву вголос? Якщо ні — викидай і думай далі.${advice(gpt)}`,

	logo: (pos: Pos, name: string, slogan: string, idea?: string) =>
		`Позиціонування: «${pos.positioning}». Роль бренду: ${pos.role}. Ворог: ${pos.enemy}.\n${idea ? `Креативна ідея: «${idea}».\n` : ''}Обрана назва: «${name}». Слоган: «${slogan}».\n\nНамалюй знак під цю назву: одна сильна форма, два кольори на контрастному тлі, від 2 до 6 фігур, без тексту. Знак показуємо піксельним 32×32, тож дрібні деталі зникнуть — форма має бути крупна й проста.`,

	/** Узгоджена переробка основи: правки гравця або клієнта, кожен вирішує свою частину. */
	reposition: (who: 'керівник агенції' | 'клієнт', notes: string[], cur: Pos) =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`Поточне позиціонування: «${cur.positioning}». Роль: ${cur.role}. Ворог: ${cur.enemy}.\n` +
		`Вирішуй як стратегиня: якщо правки стосуються суті — зміни позиціонування (changed: true), якщо ні — лиши як є (changed: false).` +
		(who === 'клієнт' ? ' Клієнт платить, тож його вимоги виконуємо, навіть коли вони псують ідею: впиши їх у позиціонування якомога дослівніше (changed: true), лише збережи одне речення.' : ''),

	rename: (who: 'керівник агенції' | 'клієнт', notes: string[], pos: Pos, posChanged: boolean, name: string, slogan: string, idea = '') =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`${posChanged ? 'Стратегиня змінила позиціонування' : 'Позиціонування лишилось'}: «${pos.positioning}». Роль: ${pos.role}. Ворог: ${pos.enemy}.\n` +
		`${idea ? `Поточна креативна ідея: «${idea}».\n` : ''}Поточні назва «${name}» і слоган «${slogan}». Якщо правки чи нове позиціонування цього вимагають — зміни ідею, назву чи слоган (changed: true), інакше лиши (changed: false).${who === 'клієнт' ? ' Вимоги клієнта виконуй дослівно, навіть якщо слоган стане гіршим — він платить.' : ''}`,

	relogo: (who: 'керівник агенції' | 'клієнт', notes: string[], pos: Pos, name: string) =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`Позиціонування: «${pos.positioning}». Назва: «${name}».\nПеремалюй знак з урахуванням правок і назви. Якщо правки не про знак — лиши ту саму форму, можна уточнити кольори.${who === 'клієнт' ? ' Вимоги клієнта до знака (більше, яскравіше, золото тощо) виконуй буквально.' : ''} Знак піксельний 32×32: крупна проста форма, від 2 до 6 видимих фігур.`,

	content: (id: ContentElement, pack: string) => `Клієнт затвердив основу:\n${pack}\n\nУся реклама — втілення креативної ідеї. Тепер ${CONTENT_TASK[id]} Дуже коротко, без пояснень.`,

	recontent: (id: ContentElement, who: 'керівник агенції' | 'клієнт', notes: string[], cur: ElementValue) =>
		`${who === 'клієнт' ? 'Клієнт' : 'Керівник агенції'} дав правки до каналів:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n` +
		`Твоя поточна версія «${ELEMENT_TITLE[id]}»:\n${[cur.text, ...cur.details].join('\n')}\n\nПерероби з урахуванням правок, що стосуються саме цього каналу; решту лиши. Так само коротко.${who === 'клієнт' ? ' Клієнт платить, тож його штуки (сайт, QR-код, «АКЦІЯ», телефон, знижка тощо) вписуємо, але з розумом і з гумором: на банер — майже все підряд, у Threads і Reels — одну-дві, обіграні смішно, у ролик — те, що клієнт просить (продукт крупно, ціна, «АКЦІЯ» у фіналі, диктор), навіть якщо від ідеї мало що лишиться. Не повторюй однакову штуку в кожному каналі.' : ''}`,

	gpt: (role: Role, question: string, chunks: { source: string; text: string }[]) =>
		`${ROLE_NAME[role]} питає: ${question}\n\n` +
		(chunks.length ? `Уривки з бази знань:\n${chunks.map((c, i) => `[${i + 1}] (${c.source}) ${c.text}`).join('\n\n')}` : 'Уривків з бази знань нема.'),

	client: (items: ElementValue[], stage: 'core' | 'content', round: number, extra?: string, asked: string[] = [], hints: string[] = [], gender: 'm' | 'f' = 'm', mix?: Mix, budget?: number, last?: boolean) =>
		'Спершу скажи 3 короткі репліки вголос (lines): про конкретні речі з того, що бачиш, твоїми словами. Потім підсумок і рішення.\n\n' +
		(asked.length ? `Ти вже просив раніше (не повторюйся, вигадай інше):\n${asked.map((a) => `- ${a}`).join('\n')}\n\n` : '') +
		(hints.length ? `Цього разу тебе чомусь чіпляє (візьми щось звідси, своїми словами): ${hints.join('; ')}.\nЗнижку чи акцію згадуй щонайбільше в одній вимозі за весь проєкт. Кожна вимога — про одну штуку.\n\n` : '') +
		`Агенція показує${round > 1 ? ` (коло ${round}, після твоїх правок)` : ''}:\n${items.map((e) => `- ${ELEMENT_TITLE[e.id]}: ${e.text}${e.details.length ? ' (' + e.details.slice(0, 4).join('; ') + ')' : ''}`).join('\n')}` +
		(extra ? `\n\n${extra}` : '') +
		`\n\n${CLIENT_ROUND[stage][last === undefined ? Math.min(round, CLIENT_ROUND[stage].length) - 1 : last ? CLIENT_ROUND[stage].length - 1 : Math.min(round, CLIENT_ROUND[stage].length - 1) - 1].replace('{spouse}', gender === 'f' ? 'чоловік' : 'дружина')}` +
		(mix ? `\n${mixText(mix, stage === 'content' ? budget : undefined)}` : '') +
		(gender === 'f' ? '\nТи жінка: про себе в жіночому роді; якщо згадуєш родину — це чоловік, не дружина.' : ''),

	persona: (text: string) => `Бриф:\n«${text}»`
};

export interface Pos { positioning: string; role: string; enemy: string }

/**
 * Сценарій клієнта. Команда приносить цілісний проєкт, клієнт за два кола перетворює його на свою «ціганщину»
 * і на третьому щиро радіє. Комунікацію — одне коло з типовими «а додайте», потім «беру».
 */
const CLIENT_ROUND: Record<'core' | 'content', string[]> = {
	core: [
		'Перше знайомство з роботою. Ідея тебе лякає, хоч ти в цьому не зізнаєшся, і агенції ти до кінця не довіряєш. Не погоджуйся одразу: verdict "rework".',
		'Агенція врахувала твої правки. Ти вже показав роботу куму і {spouse}, і тепер тобі ще страшніше, що люди «не так зрозуміють». Додай своє: що є в конкурента, що любиш ти (більший логотип, золото, «щоб було видно», «як у Києві»). verdict "rework".',
		'Агенція зробила все, як ти казав. Перечитай вголос конкретні пункти — процитуй назву, слоган, шматок позиціонування — і щиро захоплюйся тим, у що воно перетворилось, навіть якщо це вже абсурд. Ти дуже задоволений: verdict "ok", mood 85–100, demands порожньо.'
	],
	content: [
		'Платформу ти вже затвердив. Тепер реклама — і тут ти точно знаєш, як треба. «Серйозні» правки тут — твої улюблені штуки, що пасують твоєму бізнесу: САЙТ, QR-код, велике слово «АКЦІЯ», номер телефону на пів банера, «-20%», «працюємо з 1998 року», фото власника, «доставка безкоштовно», п’ять зірочок відгуків, «ми в Instagram», «найкращі в місті». Жартуй у своїй манері. verdict "rework".',
		'Агенція все додала. Ти в захваті: нарешті воно «продає». Похвали конкретні додані штуки. verdict "ok", mood 90–100, demands порожньо.'
	]
};

/**
 * Склад правок клієнта: кількість різна (від 1 до 7), більшість — «повітря» і тупі питання, решта — «серйозні»
 * правки зі страху, що вбивають сміливу ідею. Так гра тонко показує, чому сміливе рідко доживає до ефіру.
 */
export type Mix = { empty: number; dumb: number; serious: number };

export function mixText(m: Mix, budget?: number): string {
	const total = m.empty + m.dumb + m.serious;
	const lines = [
		m.empty ? `- ${m.empty} — «повітря»: смакова дрібниця, від якої нічого не зміниться, але для тебе це принципово (колір на відтінок темніший, зсунути щось на 1 піксель, шрифт «якийсь не такий», «щоб більше дихало», «зробіть живіше, але серйозно»). Про конкретну річ з роботи.` : '',
		m.dumb ? `- ${m.dumb} — тупе питання про сенс, від якого агенції стане ніяково: ти не зрозумів простої речі в ідеї чи позиціонуванні й питаєш це цілком серйозно (на кшталт «а інсайт теж буде на вивісці?»; не питай «ми ж ні з ким не воюємо» — це вже всі питали). Про цю роботу, своїми словами.` : '',
		m.serious ? `- ${m.serious} — «серйозна» правка, що вбиває сміливу ідею, бо тобі страшно: «а якщо люди подумають…», «а що скажуть конкуренти, сусіди, податкова», «приберіть жарт, ми серйозна фірма», «давайте як у всіх, тільки краще». Формулюй як турботу про бізнес.` : '',
		budget ? `- одна із «серйозних» — віддати весь рекламний бюджет (${budget.toLocaleString('uk-UA')} ₴) на ролик на телебаченні або білборди на трасі, бо «рілси — це для дітей».` : ''
	].filter(Boolean);
	return `У demands рівно ${total} ${total === 1 ? 'вимога' : total < 5 ? 'вимоги' : 'вимог'}, упереміш:\n${lines.join('\n')}\nУ kind кожної вимоги познач тип: air, question або fear.\nПриклади в дужках — лише тип правки: слова з них не повторюй, придумай своє про цю роботу. Кожна правка про іншу річ.\nУ lines скажи вголос найабсурднішу з них. Ти щиро віриш, що рятуєш бізнес: смішно має бути від того, наскільки серйозно ти це кажеш, а не від образ.`;
}

const CONTENT_TASK: Record<ContentElement, string> = {
	threads: 'голос бренду одним реченням і 3 пости для українського Threads. Там сидить пів країни, і заходить не реклама, а всрата автентичність: бренд пише як людина о другій ночі. Формати, що там живуть: «тредс, …» (звертання до всіх), «скажіть, що я не одна така», «ніхто: / абсолютно ніхто: / ми: …», «які ваші ред флеги …», «чесне слово, …», зізнання, ниття, байт на коментарі, «прийшли з інсти, тут хоч поговорити можна». Пиши з маленької літери, коротко, до 120 знаків, без крапки в кінці, можна одне слово капсом для крику. Кожен пост — інший формат. Без хештегів, цін і «купуйте». Без серйозних тез і повчань, без пояснення жарту. Деталі — зі світу цього бренду, не побутові штампи.',
	instagram: 'банер для Instagram: заголовок до 6 слів і що на картинці одним реченням. Картинка показує результат для людини: що вона отримала завдяки бренду, щоб з першого погляду було ясно, навіщо це купувати чи скачувати.',
	reels: '3 ідеї для Reels, які хочеться переслати другу: перекручений мем-тренд з несподіваним фіналом або сміливий офлайн-прикол чи челендж, знятий на телефон. Гачок у перші 2 секунди. Кожна одним рядком: що в кадрі і в чому прикол.',
	youtube: 'короткий рекламний ролик на 15–20 секунд, що втілює креативну ідею: смішний, сміливий, з гачком у першому кадрі й несподіваним поворотом; у фіналі — що людина отримала завдяки бренду і сам бренд. Не іміджева драма про почуття і не «продукт крупно з ціною» — такий ролик хочеться переслати. Без цін, акцій, телефонів і написів. Назва до 5 слів і 4 кадри, кожен одним рядком до 14 слів — що видно і що відбувається.'
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

export function normIdea(j: Record<string, unknown>) {
	const idea = str(j.idea, 300);
	if (!idea) throw new StepError('копірайтер не дав ідею');
	return { thought: str(j.thought, 120), idea: str(j.idea, 160), how: strs(j.how, 1, 120), why: str(j.why, 100) };
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
	const changed = j.changed === true && !!(str(j.name) || str(j.idea));
	return { thought: str(j.thought, 120), changed, idea: changed ? str(j.idea, 300) : '', name: changed ? str(j.name, 60) || name : name, slogan: changed ? str(j.slogan, 120) || slogan : slogan, why: str(j.why, 160) };
}

export function normContent(id: ContentElement, j: Record<string, unknown>): { thought: string; text: string; details: string[] } {
	const thought = str(j.thought, 120);
	switch (id) {
		case 'threads':
			return { thought, text: str(j.voice, 160), details: arr(j.posts).map((x) => (typeof x === 'string' ? clean(x, true).slice(0, 240) : '')).filter(Boolean).slice(0, 3) };
		case 'instagram':
			return { thought, text: str(j.headline, 80), details: [str(j.visual, 200)].filter(Boolean) };
		case 'reels':
			return { thought, text: 'Три ідеї', details: strs(j.hooks, 3, 140) };
		case 'youtube':
			return { thought, text: str(j.title, 80), details: strs(j.scenes, 4, 120) };
	}
}

export function normGpt(j: Record<string, unknown>) {
	return { answer: str(j.answer, 240), source: str(j.source, 80) };
}

/** Вердикт за сценарієм: поки не останнє коло — правки (навіть якщо модель «погодилась»), на останньому — «так». */
export function normClient(j: Record<string, unknown>, stage: 'core' | 'content', round: number, lastRound?: number) {
	const last = round >= (lastRound ?? (stage === 'core' ? 3 : 2));
	const verdict: 'ok' | 'rework' = last ? 'ok' : 'rework';
	const raw0 = arr(j.demands).slice(0, 7).map((x) => (typeof x === 'string' ? { text: str(x, 160), kind: '' } : { text: str((x as Record<string, unknown>)?.text, 160), kind: String((x as Record<string, unknown>)?.kind ?? '') })).filter((d) => d.text);
	let demands = raw0.map((d) => d.text);
	let cringe = raw0.flatMap((d, i) => (d.kind === 'fear' ? [i] : []));
	if (verdict === 'rework' && !demands.length) {
		demands = stage === 'core' ? ['логотип більший', 'щоб було видно, що ми найкращі'] : ['додайте QR-код', 'велике слово «АКЦІЯ»', 'номер телефону більше'];
		cringe = [1];
	}
	const raw = Math.round(Number(j.mood) || 50);
	const mood = Math.max(0, Math.min(100, last ? Math.max(85, raw) : Math.min(70, raw)));
	const lines = strs(j.lines, 3, 90);
	return { reaction: str(j.reaction, 300), lines: lines.length ? lines : [str(j.reaction, 90)].filter(Boolean), verdict, mood, demands: verdict === 'rework' ? demands : [], cringe: verdict === 'rework' ? cringe : [] };
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
