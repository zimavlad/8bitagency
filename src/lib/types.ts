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

/** Елементи, які затверджує гравець. Пакет А — до клієнта, пакет Б — після. */
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
	threads: 'Tone of voice для Threads',
	instagram: 'Креатив для Instagram',
	reels: 'Ідеї для Reels',
	youtube: 'Іміджевий ролик для YouTube'
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

export interface Client {
	name: string;
	business: string;
	/** Характер: від нього залежить, чого він хоче й як сварить. */
	archetype: string;
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

export interface GameState {
	day: number;
	money: number;
	reputation: number;
	burnout: Burnout;
	inbox: Brief[];
	history: HistoryEntry[];
	/** Є активний бриф — нового не беремо. */
	activeRun: string | null;
	bankrupt: boolean;
}

/** Значення елемента, яке показується гравцю й клієнту. */
export interface ElementValue {
	id: ElementId;
	/** Головний текст картки. */
	text: string;
	/** Додаткові рядки: варіанти, пояснення, сценарій. */
	details: string[];
	logo?: LogoSpec;
	/** Що відкинули — для чесності. */
	rejected?: { text: string; reason: string }[];
	edited: boolean;
	approved: boolean;
	/** Скільки разів переробляли на вимогу клієнта. */
	clientReworks: number;
}

export type RunPhase =
	| 'read'
	| 'review'
	| 'core'
	| 'player_core'
	| 'client_core'
	| 'rework_core'
	| 'content'
	| 'player_content'
	| 'client_content'
	| 'rework_content'
	| 'done'
	| 'failed';

export type Spot = 'desk' | 'table' | 'board' | 'coffee';

export interface AgentView {
	status: 'idle' | 'thinking' | 'gpt' | 'done' | 'tired';
	spot: Spot;
	burnout: number;
}

export interface Speech {
	seq: number;
	who: Speaker;
	/** Кому Джіпітенко відповідає / кого клієнт сварить. */
	to?: Role;
	text: string;
	kind: 'thought' | 'gpt' | 'client' | 'system';
}

export interface LogEntry {
	seq: number;
	who: Speaker | 'system';
	text: string;
}

export interface ClientVerdict {
	stage: 'core' | 'content';
	round: number;
	reaction: string;
	demands: { element: ElementId; demand: string }[];
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
	/** Що зараз відбувається, людською мовою. */
	status: string;
	agents: Record<Role, AgentView>;
	clientInOffice: boolean;
	elements: Partial<Record<ElementId, ElementValue>>;
	speech: Speech[];
	log: LogEntry[];
	verdicts: ClientVerdict[];
	result: RunResult | null;
	error: string | null;
	demo: boolean;
	calls: number;
	costUsd: number;
}
