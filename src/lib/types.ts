/** Спільні типи сервера й інтерфейсу. */

export type Role = 'strategist' | 'copywriter' | 'designer';
export const ROLES: Role[] = ['strategist', 'copywriter', 'designer'];

export const ROLE_NAME: Record<Role, string> = {
	strategist: 'Стратегиня',
	copywriter: 'Копірайтер',
	designer: 'Дизайнер'
};

/** Хто говорить у баблі: троє команди, Джіпітенко або клієнт. */
export type Speaker = Role | 'gpt' | 'client';

/** Основа — до клієнта; канали — після «так» від клієнта. */
export type CoreElement = 'positioning' | 'idea' | 'name' | 'slogan' | 'logo';
export type ContentElement = 'threads' | 'instagram' | 'reels' | 'youtube';
export type ElementId = CoreElement | ContentElement;

export const CORE: CoreElement[] = ['positioning', 'idea', 'name', 'slogan', 'logo'];
export const CONTENT: ContentElement[] = ['threads', 'instagram', 'reels', 'youtube'];

export const ELEMENT_TITLE: Record<ElementId, string> = {
	positioning: 'Позиціонування',
	idea: 'Креативна ідея',
	name: 'Назва',
	slogan: 'Слоган',
	logo: 'Лого',
	threads: 'Threads: пости',
	instagram: 'Instagram: банер',
	reels: 'Reels: ідеї',
	youtube: 'Рекламний ролик'
};

export const ELEMENT_OWNER: Record<ElementId, Role> = {
	positioning: 'strategist',
	idea: 'copywriter',
	name: 'copywriter',
	slogan: 'copywriter',
	logo: 'designer',
	threads: 'copywriter',
	instagram: 'designer',
	reels: 'copywriter',
	youtube: 'strategist'
};

/** Знак описують фігури з числами, SVG з них будує наш код (src/lib/logo.ts). */
export type LogoShape =
	| { type: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill: 'a' | 'b' }
	| { type: 'circle'; cx: number; cy: number; r: number; fill: 'a' | 'b' }
	| { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: 'a' | 'b' }
	| { type: 'polygon'; points: number[]; fill: 'a' | 'b' }
	| { type: 'path'; d: string; fill: 'a' | 'b' };

export interface LogoSpec {
	/** a — головна форма, b — друга, bg — тло плитки знака. */
	palette: { a: string; b: string; bg?: string };
	shapes: LogoShape[];
}

/** Як виглядає клієнт: стать і стиль визначають спрайт і палітру. */
export type ClientLook = 'leather' | 'suit' | 'casual' | 'creative' | 'farmer' | 'sport';

export interface Client {
	/** Лише імʼя, без по батькові. */
	name: string;
	/** Посада або статус: власниця, директор з продажу… */
	role?: string;
	business: string;
	/** Характер: від нього залежить, чого він хоче й як сварить. */
	archetype: string;
	gender: 'm' | 'f';
	look: ClientLook;
	/** Як говорить: 2–4 слова-маркери манери. */
	voice?: string;
}

export interface BriefForm {
	business: string;
	goals: string;
	wishes: string;
	competitors: string;
	usp: string;
}

export interface Brief {
	id: string;
	client: Client;
	text: string;
	/** Чек у гривнях: 20% передплата на старті, 80% — коли клієнт прийме все. */
	fee: number;
	/** Передплата в гривнях (20% чеку), приходить, щойно береш бриф. */
	prepay: number;
	/** Рівень клієнта: 1 — дрібний бізнес, 2 — середній, 3 — великий. */
	tier: number;
	/** Рекламний бюджет клієнта в гривнях (з середнього бізнесу): команда шукає дешеві віральні ходи, клієнт хоче телевізор. */
	budget?: number;
	custom?: boolean;
}

/** Передплата — частка чеку на старті; решта — коли клієнт прийме і платформу, і комунікацію. */
export const PREPAY_SHARE = 0.2;

export const TIER_NAME: Record<number, string> = { 1: 'дрібний бізнес', 2: 'середній бізнес', 3: 'великі гроші' };

/** Рівень агенції за репутацією: від нього залежать клієнти, чеки й витрати. */
export function tierOf(reputation: number): number {
	return reputation >= 70 ? 3 : reputation >= 40 ? 2 : 1;
}

/** Оренда за день за рівнем агенції. */
export const RENT: Record<number, number> = { 1: 600, 2: 1600, 3: 3600 };
/** Зарплата джуна за день за рівнем; мідл отримує вдвічі більше. */
export const SALARY: Record<number, number> = { 1: 300, 2: 800, 3: 1800 };

export type Grade = 'junior' | 'middle';
export const GRADE_NAME: Record<Grade, string> = { junior: 'junior', middle: 'middle' };
/** Скільки прийнятих проєктів — і людина приходить просити підвищення. */
export const PROMO_AFTER = 5;

export interface Staff {
	grade: Grade;
	/** Прийняті клієнтом проєкти. */
	done: number;
	/** Образився після відмови в підвищенні: працює абияк до вихідного. */
	sulk: boolean;
}

/** Щоденні витрати: оренда + зарплати з урахуванням грейдів. */
export function dailyCost(reputation: number, team: Record<Role, Staff>): number {
	const t = tierOf(reputation);
	return RENT[t] + ROLES.reduce((n, r) => n + SALARY[t] * (team[r].grade === 'middle' ? 2 : 1), 0);
}

/** Інвестор дав тиждень: на ранок цього дня гроші мають бути більші за стартові. */
export const DEADLINE_DAY = 8;
export const START_MONEY = 12000;

export interface Burnout {
	strategist: number;
	copywriter: number;
	designer: number;
}

/** Що можна зробити для команди раз на день. */
export interface Perks {
	day: number;
	pizza: boolean;
	praised: Role[];
}

export const PIZZA_COST = 400;

/** Кейс для борду: що вийшло в підсумку. */
export interface CaseData {
	positioning: string;
	idea?: string;
	name: string;
	slogan: string;
	logo?: LogoSpec;
	instagram?: { text: string; image?: string };
	youtube?: { text: string; image?: string; scenes: string[] };
	threads?: string[];
}

export interface HistoryEntry {
	case?: CaseData;
	day: number;
	client: string;
	business: string;
	name: string;
	verdict: 'ok' | 'reject' | 'dropped';
	paid: number;
	repDelta: number;
}

/** Баланс рахунку: Влад вводить суму з консолі, гра віднімає власні витрати від цієї дати. */
export interface Balance {
	usd: number;
	at: string;
	spent: number;
}

export interface Ledger {
	claude: Balance;
	gemini: Balance;
}

export interface GameState {
	day: number;
	money: number;
	reputation: number;
	/** Стрес (колишнє вигорання): росте від роботи й правок. */
	burnout: Burnout;
	/** Мораль: падає, коли клієнт незадоволений; росте від перемог, похвали, піци. */
	morale: Burnout;
	/** Здоровʼя: поки завжди 100 — на наступних рівнях тривоги й обстріли. */
	hp: Burnout;
	perks: Perks;
	team: Record<Role, Staff>;
	/** Хто прийшов просити підвищення (лист чекає відповіді). */
	ask: Role | null;
	/** Годинник у грі: новий день починається о 9:00, бриф просуває час. */
	clock: number;
	/** Чим закінчилась гра, якщо закінчилась. */
	over: 'bankrupt' | 'investor' | null;
	/** Інвестор задоволений: тиждень пройдено в плюс. */
	investorOk: boolean;
	inbox: Brief[];
	history: HistoryEntry[];
	activeRun: string | null;
	bankrupt: boolean;
	ledger: Ledger;
}

export interface NamingOption {
	name: string;
	slogan: string;
	why: string;
}

/** Значення елемента, яке показується гравцю й клієнту. */
export interface ElementValue {
	id: ElementId;
	text: string;
	details: string[];
	logo?: LogoSpec;
	/** Картинка від Gemini (банер, розкадровка). */
	image?: string;
	rejected?: { text: string; reason: string }[];
	/** Чому так — коротко, для зведення перед клієнтом. */
	why?: string;
	/** Скільки разів переробляли (правки гравця й клієнта). */
	reworks: number;
}

export type RunPhase =
	| 'read'
	| 'huddle'
	| 'position'
	| 'naming'
	| 'pick_name'
	| 'logo'
	| 'player_core'
	| 'rework_core'
	| 'client_core'
	| 'client_decision_core'
	| 'content'
	| 'images'
	| 'player_content'
	| 'rework_content'
	| 'client_content'
	| 'client_decision_content'
	| 'done'
	| 'failed';

export type Spot = 'desk' | 'table' | 'board' | 'coffee' | 'away' | 'armchair';

export interface AgentView {
	status: 'idle' | 'thinking' | 'gpt' | 'done' | 'tired';
	spot: Spot;
	burnout: number;
	morale: number;
	hp: number;
	/** Що робить зараз — коротко, для панелі команди. */
	doing: string;
}

export interface Speech {
	seq: number;
	who: Speaker;
	to?: Role;
	text: string;
	kind: 'thought' | 'gpt' | 'client' | 'system';
}

export interface LogEntry {
	seq: number;
	who: Speaker | 'system';
	text: string;
	/** Розгорнуто: що саме видав агент (для ланцюжка думок). */
	more?: string[];
}

export interface ClientVerdict {
	stage: 'core' | 'content';
	round: number;
	reaction: string;
	/** Короткі репліки-доїбки над головою, до 60 знаків. */
	lines: string[];
	demands: string[];
	/** Які з вимог «кринжові» (вбивають ідею) — гравцю не показуємо, рахує настрій. */
	cringe?: number[];
	/** Які вимоги гравець узяв у роботу. */
	picked?: number[];
	verdict: 'ok' | 'rework' | 'reject';
	mood: number;
}

export interface RunResult {
	verdict: 'ok' | 'reject' | 'dropped';
	paid: number;
	/** Розшифровка оплати: за що саме гроші. */
	pay: { label: string; amount: number }[];
	repDelta: number;
	quality: number;
	notes: string[];
	burnoutDelta: Burnout;
	moraleDelta: Burnout;
}

/** Розбір брифу стратегинею (Four Points). */
export interface Strategy {
	problem: string;
	insight: string;
	advantage: string;
	direction: string;
}

export interface Task {
	stage: 'platform' | 'comms';
	label: string;
	done: number;
	total: number;
	/** Коли почався поточний крок (мс) і скільки він приблизно триває. */
	at: number;
	pace: number;
}

export type StepKey = 'strategy' | 'name' | 'logo' | 'you_core' | 'client_core' | 'content' | 'you_content' | 'client_content' | 'done';

/** Що сталося на етапі — щоб можна було повернутись і переглянути. */
export interface StepRecord {
	key: StepKey;
	lines: string[];
	logos?: LogoSpec[];
}

export interface RunState {
	id: string;
	brief: Brief;
	phase: RunPhase;
	status: string;
	paused: boolean;
	agents: Record<Role, AgentView>;
	clientInOffice: boolean;
	elements: Partial<Record<ElementId, ElementValue>>;
	strategy: Strategy | null;
	steps: StepRecord[];
	/** Годинник у грі (години, можуть перейти за 24 — це вже ніч і наступний ранок). */
	clock: number;
	/** Скільки ще разів можна попросити нові назви. */
	rerolls: number;
	/** Що змінилось у останній переробці — позначка «нове» у зведенні. */
	changed: ElementId[];
	/** Поточна робота між рішеннями гравця: прогрес по кроках для смужки справа. */
	task: Task | null;
	/** Варіанти назви й слогана, з яких обирає гравець. */
	options: NamingOption[];
	/** Чи ще можна дати раунд правок на поточному етапі. */
	editAvailable: boolean;
	clientRound: number;
	speech: Speech[];
	log: LogEntry[];
	verdicts: ClientVerdict[];
	result: RunResult | null;
	error: string | null;
	demo: boolean;
	calls: number;
	costUsd: number;
	imagesUsd: number;
}

/** Платформу клієнт приймає на 3-му колі, комунікацію — на 2-му: два кола «доїбок», потім «так». */
/** Скільки ігрових годин займає один крок команди: повний бриф з усіма колами — від ранку до наступного ранку. */
export const STEP_HOURS = 1;
export const DAY_START = 9;

export const MAX_CLIENT_ROUNDS = 3;
export const COMMS_ROUNDS = 2;
export const EDIT_SLOTS = 3;
