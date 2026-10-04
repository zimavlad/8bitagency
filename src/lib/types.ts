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
export type CoreElement = 'positioning' | 'name' | 'slogan' | 'logo';
export type ContentElement = 'threads' | 'instagram' | 'reels' | 'youtube';
export type ElementId = CoreElement | ContentElement;

export const CORE: CoreElement[] = ['positioning', 'name', 'slogan', 'logo'];
export const CONTENT: ContentElement[] = ['threads', 'instagram', 'reels', 'youtube'];

export const ELEMENT_TITLE: Record<ElementId, string> = {
	positioning: 'Позиціонування',
	name: 'Назва',
	slogan: 'Слоган',
	logo: 'Лого',
	threads: 'Threads: голос бренду',
	instagram: 'Instagram: банер',
	reels: 'Reels: ідеї',
	youtube: 'YouTube: іміджевий ролик'
};

export const ELEMENT_OWNER: Record<ElementId, Role> = {
	positioning: 'strategist',
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
	palette: { a: string; b: string };
	shapes: LogoShape[];
}

/** Як виглядає клієнт: стать і стиль визначають спрайт і палітру. */
export type ClientLook = 'leather' | 'suit' | 'casual' | 'creative' | 'farmer' | 'sport';

export interface Client {
	name: string;
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
	/** Гонорар у гривнях, якщо клієнт прийме. */
	fee: number;
	custom?: boolean;
}

export interface Burnout {
	strategist: number;
	copywriter: number;
	designer: number;
}

export interface HistoryEntry {
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
	burnout: Burnout;
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

export type Spot = 'desk' | 'table' | 'board' | 'coffee' | 'away';

export interface AgentView {
	status: 'idle' | 'thinking' | 'gpt' | 'done' | 'tired';
	spot: Spot;
	burnout: number;
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
	demands: string[];
	verdict: 'ok' | 'rework' | 'reject';
	mood: number;
}

export interface RunResult {
	verdict: 'ok' | 'reject' | 'dropped';
	paid: number;
	repDelta: number;
	quality: number;
	notes: string[];
	burnoutDelta: Burnout;
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

export const MAX_CLIENT_ROUNDS = 3;
export const EDIT_SLOTS = 3;
