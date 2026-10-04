import { ROLES, ROLE_NAME, type LogoSpec, type Role, type Speaker, type Spot } from '$lib/types';
import { BACK, BODY, CAT, EMOTE, LEGS, PALETTE, SPRITE_H, SPRITE_W, clientSprite, type SpriteId } from './sprites';

/**
 * Ізометричний офіс у справжній піксельній сітці, як у Stardew Valley: сцена малюється в маленьке
 * полотно 358×270 (1 логічний піксель = 1 піксель арту), а на екран збільшується без згладжування.
 * Сцена може все (тіні, гострі кути, кольори агентів), обгортка — за правилами інтерфейсу.
 */

export type Sky = 'clear' | 'clouds' | 'rain' | 'snow' | 'storm' | 'fog';

export interface SceneInput {
	agents: Record<Role, { spot: Spot; status: string; burnout: number }>;
	clientInOffice: boolean;
	gptFor: Role | null;
	speaking: Speaker[];
	board: { positioning: boolean; name: boolean; slogan: boolean; logo: boolean };
	logo: LogoSpec | null;
	hour: number;
	sky: Sky;
	reducedMotion: boolean;
	client: { gender: 'm' | 'f'; look: 'leather' | 'suit' | 'casual' | 'creative' | 'farmer' | 'sport' };
	/** Вихідний: усі йдуть у двері й зникають. */
	away: boolean;
	/** Скільки кави в колбі, 0..1. Пара йде, лише коли кава є. */
	coffee?: number;
}

/* ─────────── геометрія ─────────── */
const TW = 24, TH = 12, GW = 8, GH = 6, WH = 80, PAD = 11;
const OX = GH * TW + PAD;
const OY = WH + PAD;
export const SCENE_W = (GW + GH) * TW + PAD * 2; // 358
export const SCENE_H = (GW + GH) * TH + WH + PAD * 2; // 270

type P = { x: number; y: number };
const s = (gx: number, gy: number): P => ({ x: OX + (gx - gy) * TW, y: OY + (gx + gy) * TH });
const wL = (d: number, h: number): P => ({ x: OX - d * TW, y: OY + d * TH - h });
const wR = (d: number, h: number): P => ({ x: OX + d * TW, y: OY + d * TH - h });
const at = (gx: number, gy: number, h: number): P => { const p = s(gx, gy); return { x: p.x, y: p.y - h }; };

/** Детермінований шум: однаковий кадр щоразу (тести, скріншоти). */
const hash = (a: number, b = 0) => {
	let h = (a * 374761393 + b * 668265263) | 0;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/* ─────────── палітра в дусі Stardew ─────────── */
const C = {
	ink: '#2e1d16',
	// стіни: тепла шпалера з візерунком, дерев'яні панелі знизу
	wallL: '#f2d9b0', wallLs: '#e7c896', wallLdot: '#d9b07a',
	wallR: '#e9c895', wallRs: '#ddb67e', wallRdot: '#c99d63',
	panel: '#9b6a42', panelLt: '#b5804f', panelDk: '#7a5032', rail: '#c8925a',
	crown: '#a87848', crownLt: '#cf9c63',
	// підлога: дошки трьох тонів
	plank: ['#c78a52', '#bd7f4a', '#d09659', '#b87a45'],
	plankLine: '#8f5a33', plankGrain: '#a96f40',
	wood: '#a8703f', woodTop: '#c58c55', woodLt: '#dba86d', woodDk: '#7d4f2c', woodDkr: '#5e3a20',
	metal: '#8e9aa6', metalDk: '#5f6a75', metalTop: '#b3bec8',
	screen: '#24372f', screenOn: '#7fd29a', screenOn2: '#c3f0cf',
	rug: '#a34a3d', rugIn: '#c76b52', rugPat: '#e8b46a', rugEdge: '#6e2f28',
	leaf: '#5aa04a', leafDk: '#3a7a36', leafLt: '#8cc86a', leafInk: '#24502a',
	pot: '#c9704a', potDk: '#9a4f32', potLt: '#e3936a',
	paper: '#fdf8ec', paperDk: '#e6dcc4', mug: '#f6f2ea', coffee: '#6b4226',
	door: '#8a5a38', doorDk: '#64402a', doorLt: '#a87048', brass: '#f0c35a',
	cork: '#c9935a', corkDk: '#a87240',
	gpt: '#5ee6c8', gptDk: '#1f8f7a',
	sofa: '#7a3f4f', sofaLt: '#9c5466', sofaDk: '#5a2c3a',
	book: ['#c8463a', '#3f6fae', '#e0a43a', '#4f8f4a', '#8a52a8', '#d9734a', '#2f7f86', '#a8a038'],
	bulb: ['#ffd27a', '#ff9f6b', '#9fe0a0', '#ffb3d1', '#9fd0ff']
};

/* ─────────── місця ─────────── */
/** Столи під задньою стіною; людина сидить перед столом на кріслі, спиною до глядача, екран дивиться на нас. */
const DESKS: Record<Role, { gx: number; gy: number }> = { strategist: { gx: 0.75, gy: 0.3 }, copywriter: { gx: 3.15, gy: 0.3 }, designer: { gx: 5.55, gy: 0.3 } };
const DESK_W = 1.55, DESK_D = 0.9, DESK_H = 16;
/** Крісло біля вікна: туди іноді йдуть з ноутом. */
const ARMCHAIR = { gx: 0.6, gy: 4.0 };
const SPOTS: Record<Role, Record<Spot, { gx: number; gy: number }>> = {
	strategist: { desk: { gx: 1.45, gy: 1.55 }, table: { gx: 1.7, gy: 4.2 }, board: { gx: 2.72, gy: 0.62 }, coffee: { gx: 5.75, gy: 4.25 }, away: { gx: 0.3, gy: 5.1 }, armchair: ARMCHAIR },
	copywriter: { desk: { gx: 3.85, gy: 1.55 }, table: { gx: 3.4, gy: 2.95 }, board: { gx: 2.72, gy: 0.62 }, coffee: { gx: 5.85, gy: 5.45 }, away: { gx: 0.3, gy: 5.1 }, armchair: ARMCHAIR },
	designer: { desk: { gx: 6.25, gy: 1.55 }, table: { gx: 5.3, gy: 4.95 }, board: { gx: 2.72, gy: 0.62 }, coffee: { gx: 7.5, gy: 5.75 }, away: { gx: 0.3, gy: 5.1 }, armchair: ARMCHAIR }
};
const CLIENT_DOOR = { gx: 0.35, gy: 5.15 };
const CLIENT_TABLE = { gx: 3.45, gy: 5.85 };

/** Предмети, з якими можна взаємодіяти кліком. */
export type Thing = 'coffee' | 'pizza' | 'door';

export class Office {
	private ctx: CanvasRenderingContext2D;
	/** Полотно арту в справжній роздільності; на екран — збільшення без згладжування. */
	private art: HTMLCanvasElement;
	private o: CanvasRenderingContext2D;
	private S = 1;
	private TX = 0;
	private TY = 0;
	private DPR = 1;
	private pos: Record<SpriteId, { gx: number; gy: number; tx: number; ty: number }>;
	private raf = 0;
	private last = 0;
	private t = 0;
	private input: SceneInput;
	private ro: ResizeObserver;
	private hidden = false;

	constructor(private canvas: HTMLCanvasElement, private stage: HTMLElement, input: SceneInput) {
		this.ctx = canvas.getContext('2d')!;
		this.art = document.createElement('canvas');
		this.art.width = SCENE_W;
		this.art.height = SCENE_H;
		this.o = this.art.getContext('2d')!;
		this.input = input;
		this.pos = {
			strategist: { ...SPOTS.strategist.desk, tx: 0, ty: 0 },
			copywriter: { ...SPOTS.copywriter.desk, tx: 0, ty: 0 },
			designer: { ...SPOTS.designer.desk, tx: 0, ty: 0 },
			client: { ...CLIENT_DOOR, tx: 0, ty: 0 }
		};
		for (const k of Object.keys(this.pos) as SpriteId[]) { this.pos[k].tx = this.pos[k].gx; this.pos[k].ty = this.pos[k].gy; }
		this.ro = new ResizeObserver(() => this.fit());
		this.ro.observe(stage);
		this.fit();
		this.update(input);
		document.addEventListener('visibilitychange', this.onVis);
		this.raf = requestAnimationFrame(this.loop);
	}

	destroy() {
		cancelAnimationFrame(this.raf);
		this.ro.disconnect();
		document.removeEventListener('visibilitychange', this.onVis);
	}

	private onVis = () => {
		this.hidden = document.hidden;
		if (!this.hidden) { this.last = 0; this.raf = requestAnimationFrame(this.loop); }
	};

	update(input: SceneInput) {
		this.input = input;
		for (const r of ROLES) {
			const sp = SPOTS[r][input.away ? 'away' : input.agents[r].spot];
			this.pos[r].tx = sp.gx;
			this.pos[r].ty = sp.gy;
		}
		const c = input.clientInOffice ? CLIENT_TABLE : CLIENT_DOOR;
		this.pos.client.tx = c.gx;
		this.pos.client.ty = c.gy;
		if (input.reducedMotion) for (const k of Object.keys(this.pos) as SpriteId[]) { this.pos[k].gx = this.pos[k].tx; this.pos[k].gy = this.pos[k].ty; }
	}

	private fit() {
		const w = this.stage.clientWidth || 320;
		const h = this.stage.clientHeight || 240;
		this.DPR = Math.min(window.devicePixelRatio || 1, 2);
		this.canvas.width = Math.round(w * this.DPR);
		this.canvas.height = Math.round(h * this.DPR);
		const raw = Math.min(w / SCENE_W, h / SCENE_H);
		// Крок — один піксель пристрою: на DPR 2 масштаб 2,5 лишається чітким.
		this.S = raw < 1 ? raw : Math.max(1, Math.floor(raw * this.DPR) / this.DPR);
		this.TX = Math.round((w - SCENE_W * this.S) / 2);
		this.TY = Math.round((h - SCENE_H * this.S) / 2);
		this.draw();
	}

	/** Точка над головою мовця в CSS-пікселях усередині сцени — для баблів. */
	anchor(who: Speaker): P | null {
		if (who === 'gpt') {
			const r = this.input.gptFor;
			if (!r) return null;
			const p = this.gptPoint(r);
			return { x: this.TX + p.x * this.S, y: this.TY + (p.y - 10) * this.S };
		}
		const k: SpriteId = who === 'client' ? 'client' : who;
		if (k === 'client' && !this.input.clientInOffice) return null;
		const c = this.pos[k];
		const p = s(c.gx, c.gy);
		return { x: this.TX + p.x * this.S, y: this.TY + (p.y - SPRITE_H - 6) * this.S };
	}

	/** Полотно арту з одним кадром для заданого стану (без анімації) — для поляроїдів меню. */
	static still(input: SceneInput, t = 1.3): HTMLCanvasElement {
		const cv = document.createElement('canvas');
		const o = new Office(cv, document.createElement('div'), { ...input, reducedMotion: true });
		o.destroy();
		o.t = t;
		o.draw();
		return o.art;
	}

	/** Предмет під курсором: кавоварка, коробка піци на столі, двері. */
	thing(x: number, y: number): Thing | null {
		const ax = (x - this.TX) / this.S, ay = (y - this.TY) / this.S;
		const inBox = (pts: P[]) => ax >= Math.min(...pts.map((p) => p.x)) && ax <= Math.max(...pts.map((p) => p.x)) && ay >= Math.min(...pts.map((p) => p.y)) && ay <= Math.max(...pts.map((p) => p.y));
		if (inBox([at(6.5, 3.9, 34), at(7.9, 3.9, 34), at(7.9, 4.95, 0), at(6.5, 4.95, 0)])) return 'coffee';
		if (inBox([at(3.3, 4.05, 22), at(4.1, 4.05, 22), at(4.1, 4.85, 14), at(3.3, 4.85, 14)])) return 'pizza';
		if (inBox([wL(4.5, 0), wL(5.75, 0), wL(4.5, 52), wL(5.75, 52)])) return 'door';
		return null;
	}

	/** Точка на екрані (CSS-пікселі) для клітинки підлоги — щоб ставити поп-ап біля предмета. */
	screenOf(gx: number, gy: number, h = 0): P {
		const p = at(gx, gy, h);
		return { x: this.TX + p.x * this.S, y: this.TY + p.y * this.S };
	}

	/** Хто під пальцем/курсором (CSS-пікселі в межах сцени). */
	hit(x: number, y: number): SpriteId | null {
		const ax = (x - this.TX) / this.S, ay = (y - this.TY) / this.S;
		const order = (['strategist', 'copywriter', 'designer', 'client'] as SpriteId[]).sort((a, b) => this.pos[b].gx + this.pos[b].gy - (this.pos[a].gx + this.pos[a].gy));
		for (const k of order) {
			if (k === 'client' && !this.input.clientInOffice) continue;
			const p = s(this.pos[k].gx, this.pos[k].gy);
			if (ax >= p.x - 9 && ax <= p.x + 9 && ay >= p.y - SPRITE_H - 2 && ay <= p.y + 2) return k;
		}
		return null;
	}

	private loop = (now: number) => {
		if (this.hidden) return;
		const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
		this.last = now;
		if (!this.input.reducedMotion) this.t += dt;
		for (const k of Object.keys(this.pos) as SpriteId[]) {
			const c = this.pos[k];
			const dx = c.tx - c.gx, dy = c.ty - c.gy;
			const d = Math.hypot(dx, dy);
			const step = 2.4 * dt;
			if (d <= step || d < 0.01) { c.gx = c.tx; c.gy = c.ty; } else { c.gx += (dx / d) * step; c.gy += (dy / d) * step; }
		}
		this.draw();
		this.raf = requestAnimationFrame(this.loop);
	};

	/* ─────────── примітиви (у пікселях арту) ─────────── */
	private poly(pts: P[], fill: string) {
		const c = this.o;
		c.beginPath();
		c.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
		c.closePath();
		c.fillStyle = fill;
		c.fill();
	}
	private line(pts: P[], color: string, w = 1, close = false) {
		const c = this.o;
		c.beginPath();
		c.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
		if (close) c.closePath();
		c.strokeStyle = color;
		c.lineWidth = w;
		c.stroke();
	}
	/** Прямокутник, вирівняний по сітці пікселів. */
	private px(x: number, y: number, w: number, h: number, fill: string) { this.o.fillStyle = fill; this.o.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
	private qL(d1: number, d2: number, h1: number, h2: number, f: string) { this.poly([wL(d1, h1), wL(d2, h1), wL(d2, h2), wL(d1, h2)], f); }
	private qR(d1: number, d2: number, h1: number, h2: number, f: string) { this.poly([wR(d1, h1), wR(d2, h1), wR(d2, h2), wR(d1, h2)], f); }
	private qF(x1: number, y1: number, x2: number, y2: number, f: string) { this.poly([s(x1, y1), s(x2, y1), s(x2, y2), s(x1, y2)], f); }
	private qH(x1: number, y1: number, x2: number, y2: number, h: number, f: string) { this.poly([at(x1, y1, h), at(x2, y1, h), at(x2, y2, h), at(x1, y2, h)], f); }
	private qFace(g1: number, g2: number, gy: number, h1: number, h2: number, f: string) { this.poly([at(g1, gy, h2), at(g2, gy, h2), at(g2, gy, h1), at(g1, gy, h1)], f); }
	/** Права (+gx) грань: від gy1 до gy2 на лінії gx. */
	private qSide(gx: number, gy1: number, gy2: number, h1: number, h2: number, f: string) { this.poly([at(gx, gy1, h2), at(gx, gy2, h2), at(gx, gy2, h1), at(gx, gy1, h1)], f); }

	/** Паралелепіпед від висоти z0 до z1 (стоїть на чомусь), з кантом і обводкою — для техніки на столах. */
	private boxAt(gx: number, gy: number, w: number, d: number, z0: number, z1: number, top: string, right: string, front: string, hi: string, ink: string) {
		this.qSide(gx + w, gy, gy + d, z0, z1, right);
		this.qFace(gx, gx + w, gy + d, z0, z1, front);
		this.qH(gx, gy, gx + w, gy + d, z1, top);
		this.line([at(gx, gy + d, z1), at(gx + w, gy + d, z1), at(gx + w, gy, z1)], hi);
		this.line([at(gx, gy, z1), at(gx + w, gy, z1), at(gx + w, gy, z0), at(gx + w, gy + d, z0), at(gx, gy + d, z0), at(gx, gy + d, z1)], ink, 1, true);
	}

	/** Паралелепіпед з темною обводкою силуету й світлим кантом верхньої грані — як у Stardew. */
	private box(gx: number, gy: number, w: number, d: number, h: number, top: string, right: string, left: string, outline = true) {
		const A = s(gx, gy), B = s(gx + w, gy), Cc = s(gx + w, gy + d), D = s(gx, gy + d);
		const up = (p: P) => ({ x: p.x, y: p.y - h });
		this.poly([up(B), up(Cc), Cc, B], right);
		this.poly([up(D), up(Cc), Cc, D], left);
		this.poly([up(A), up(B), up(Cc), up(D)], top);
		if (!outline) return;
		// волокно дерева на великих гранях і темніший низ граней (дизеринг)
		if (w > 0.6 && h > 6) {
			for (let k = 1; k < 4; k++) { const z = (h * k) / 4; this.line([{ x: D.x + 2, y: D.y - z }, { x: Cc.x - 2, y: Cc.y - z }].map((p, j) => ({ x: p.x, y: p.y + (j ? -0.5 : 0) })), 'rgba(70,40,20,.18)'); }
			this.poly([{ x: D.x, y: D.y - 3 }, { x: Cc.x, y: Cc.y - 3 }, Cc, D], this.dither('rgba(50,25,10,.3)') as unknown as string);
			this.poly([{ x: B.x, y: B.y - 3 }, { x: Cc.x, y: Cc.y - 3 }, Cc, B], this.dither('rgba(40,20,8,.3)') as unknown as string);
		}
		this.line([up(D), up(Cc), up(B)], 'rgba(255,240,210,.35)');
		this.line([up(Cc), Cc], 'rgba(0,0,0,.18)');
		this.line([up(A), up(B), B, Cc, D, up(D)], C.ink, 1, true);
	}

	/** Дизеринг: шаховий (density 2) або розріджений (4) візерунок кольору — переходи без градієнтів, як у піксель-арті. */
	private dithers = new Map<string, CanvasPattern>();
	private dither(color: string, density: 2 | 4 = 2): CanvasPattern {
		const key = `${color}:${density}`;
		let pat = this.dithers.get(key);
		if (!pat) {
			const c = document.createElement('canvas');
			c.width = c.height = density === 2 ? 2 : 4;
			const x = c.getContext('2d')!;
			x.fillStyle = color;
			if (density === 2) { x.fillRect(0, 0, 1, 1); x.fillRect(1, 1, 1, 1); }
			else { x.fillRect(0, 0, 1, 1); x.fillRect(2, 2, 1, 1); }
			pat = this.o.createPattern(c, 'repeat')!;
			this.dithers.set(key, pat);
		}
		return pat;
	}

	/** Тінь під предметом: щільна серцевина й розсипаний дизеринг по краю. */
	private shadowUnder(gx: number, gy: number, w: number, d: number, a = 0.22) {
		const q = (m: number) => [s(gx + 0.08 - m, gy + 0.08 - m), s(gx + w + 0.12 + m, gy + 0.08 - m), s(gx + w + 0.12 + m, gy + d + 0.14 + m), s(gx + 0.08 - m, gy + d + 0.14 + m)];
		this.poly(q(0.08), this.dither(`rgba(60,30,15,${a * 0.9})`, 4) as unknown as string);
		this.poly(q(0.03), this.dither(`rgba(60,30,15,${a})`) as unknown as string);
		this.poly(q(-0.02), `rgba(60,30,15,${a * 0.8})`);
	}

	/* ─────────── кадр ─────────── */
	private draw() {
		const o = this.o;
		o.setTransform(1, 0, 0, 1, 0, 0);
		o.clearRect(0, 0, SCENE_W, SCENE_H);
		o.imageSmoothingEnabled = false;

		const night = this.night();
		this.shadow();
		this.walls();
		this.floor();
		if (night < 0.6 && (this.input.sky === 'clear' || this.input.sky === 'clouds')) this.sunBeam(1 - night);
		this.windowView();
		this.decor();
		this.garland(night);
		this.objects();
		this.pendant(night);
		if (night > 0) this.nightTint(night);
		this.grade(night);

		const c = this.ctx;
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.clearRect(0, 0, this.canvas.width, this.canvas.height);
		c.imageSmoothingEnabled = false;
		c.drawImage(this.art, this.TX * this.DPR, this.TY * this.DPR, SCENE_W * this.S * this.DPR, SCENE_H * this.S * this.DPR);
		this.labels();
	}

	private night(): number {
		const h = this.input.hour;
		if (h >= 8 && h < 18) return 0;
		if (h >= 22 || h < 5) return 1;
		if (h >= 18) return (h - 18) / 4;
		return 1 - (h - 5) / 3;
	}

	private shadow() {
		const f = s(GW, GH), l = s(0, GH), r = s(GW, 0);
		this.poly([{ x: l.x - 2, y: l.y + 4 }, { x: f.x, y: f.y + 7 }, { x: r.x + 2, y: r.y + 4 }, { x: f.x, y: f.y + 2 }], 'rgba(0,0,0,.25)');
	}

	/* ─────────── стіни ─────────── */
	private walls() {
		const WS = 26; // висота панелей
		// шпалери з вертикальною смугою й дрібним візерунком
		this.qL(0, GH, WS, WH, C.wallL);
		for (let d = 0; d < GH; d += 0.5) this.qL(d + 0.18, d + 0.32, WS, WH - 6, C.wallLs);
		// дрібний візерунок-ромбик шпалер
		for (let d = 0.09; d < GH; d += 0.5) for (let h = WS + 6; h < WH - 8; h += 9) { const p = wL(d + ((h / 9) % 2) * 0.25, h); this.px(p.x, p.y - 1, 1, 1, C.wallLdot); this.px(p.x - 1, p.y, 3, 1, C.wallLdot); this.px(p.x, p.y + 1, 1, 1, C.wallLdot); }
		this.qR(0, GW, WS, WH, C.wallR);
		for (let d = 0; d < GW; d += 0.5) this.qR(d + 0.18, d + 0.32, WS, WH - 6, C.wallRs);
		for (let d = 0.09; d < GW; d += 0.5) for (let h = WS + 6; h < WH - 8; h += 9) { const p = wR(d + ((h / 9) % 2) * 0.25, h); this.px(p.x, p.y - 1, 1, 1, C.wallRdot); this.px(p.x - 1, p.y, 3, 1, C.wallRdot); this.px(p.x, p.y + 1, 1, 1, C.wallRdot); }
		// під стелею стіна темнішає дизерингом, права стіна в тіні сильніше
		this.qL(0, GH, WH - 16, WH - 5, this.dither('rgba(120,70,30,.18)', 4) as unknown as string);
		this.qL(0, GH, WH - 10, WH - 5, this.dither('rgba(120,70,30,.2)') as unknown as string);
		this.qR(0, GW, WH - 18, WH - 5, this.dither('rgba(110,60,25,.2)', 4) as unknown as string);
		this.qR(0, GW, WH - 11, WH - 5, this.dither('rgba(110,60,25,.24)') as unknown as string);
		// дерев'яні панелі
		this.qL(0, GH, 0, WS, C.panel);
		this.qR(0, GW, 0, WS, C.panelDk);
		// панелі з фаскою: світла грань угорі, темна знизу, волокно всередині
		for (let d = 0.12; d < GH - 0.2; d += 0.75) {
			this.qL(d, d + 0.6, 4, WS - 6, C.panelDk); this.qL(d + 0.04, d + 0.6, 5, WS - 7, C.panel);
			this.qL(d + 0.04, d + 0.6, WS - 8, WS - 7, C.panelLt); this.qL(d + 0.04, d + 0.6, 5, 6, '#6a4228');
			for (let k = 0; k < 3; k++) this.qL(d + 0.1 + k * 0.15, d + 0.18 + k * 0.15, 8 + k * 3, 9 + k * 3, 'rgba(90,55,30,.45)');
		}
		for (let d = 0.12; d < GW - 0.2; d += 0.75) {
			this.qR(d, d + 0.6, 4, WS - 6, '#6a4228'); this.qR(d, d + 0.56, 5, WS - 7, C.panelDk);
			this.qR(d, d + 0.56, WS - 8, WS - 7, C.panel); this.qR(d, d + 0.56, 5, 6, '#5a3620');
			for (let k = 0; k < 3; k++) this.qR(d + 0.08 + k * 0.15, d + 0.16 + k * 0.15, 8 + k * 3, 9 + k * 3, 'rgba(60,35,18,.45)');
		}
		this.qL(0, GH, WS - 3, WS, C.rail); this.qR(0, GW, WS - 3, WS, C.panelLt);
		this.qL(0, GH, 0, 3, C.woodDkr); this.qR(0, GW, 0, 3, C.woodDkr);
		// карниз під стелею
		this.qL(0, GH, WH - 5, WH, C.crownLt); this.qR(0, GW, WH - 5, WH, C.crown);
		this.qL(0, GH, WH - 6, WH - 5, 'rgba(80,45,20,.35)'); this.qR(0, GW, WH - 6, WH - 5, 'rgba(80,45,20,.35)');
		// кут і обводка
		const a = wL(0, 0), b = wL(0, WH);
		this.line([a, b], 'rgba(90,50,25,.45)');
		this.line([wL(GH, 0), wL(GH, WH), wL(0, WH), wR(GW, WH), wR(GW, 0)], C.ink);
	}

	/* ─────────── підлога: дошки ─────────── */
	private floor() {
		const rows = GH * 3; // три дошки на тайл
		for (let r = 0; r < rows; r++) {
			const y1 = r / 3, y2 = (r + 1) / 3;
			let x = -(hash(r, 7) * 1.4);
			let i = 0;
			while (x < GW) {
				const len = 1.4 + hash(r, i + 31) * 1.2;
				const a = Math.max(0, x), b = Math.min(GW, x + len);
				if (b > a) {
					this.qF(a, y1, b, y2, C.plank[Math.floor(hash(r * 13 + i, 3) * C.plank.length)]);
					// світлий кант зверху й тінь знизу дошки
					this.line([s(a, y1 + 0.02), s(b, y1 + 0.02)], 'rgba(255,225,170,.28)');
					this.qF(a, y2 - 0.05, b, y2, this.dither('rgba(110,60,25,.35)') as unknown as string);
					// волокна: довгі світлі й темні штрихи вздовж дошки
					for (let k = 0; k < 4; k++) {
						const gx = a + hash(r, i * 7 + k) * (b - a), gy = y1 + 0.08 + hash(i, r * 3 + k) * 0.17;
						const len = 0.15 + hash(k, r + i) * 0.3;
						this.line([s(gx, gy), s(Math.min(b, gx + len), gy)], k % 2 ? C.plankGrain : 'rgba(255,220,160,.25)');
					}
					// сучок
					if (hash(r * 5 + i, 17) > 0.86) { const kp = s(a + (b - a) * 0.5, (y1 + y2) / 2); this.px(kp.x - 1, kp.y, 3, 1, C.plankLine); this.px(kp.x, kp.y - 1, 1, 1, C.plankGrain); }
					// шов між дошками
					if (b < GW) this.line([s(b, y1), s(b, y2)], C.plankLine);
				}
				x += len;
				i++;
			}
			this.line([s(0, y2), s(GW, y2)], 'rgba(120,70,35,.55)');
		}
		// тінь уздовж стін: суцільна біля плінтуса, далі дизеринг, що розсіюється
		this.poly([s(0, 0), s(GW, 0), s(GW, 0.16), s(0.16, 0.16)], 'rgba(60,30,10,.22)');
		this.poly([s(0, 0), s(0.16, 0.16), s(0.16, GH), s(0, GH)], 'rgba(60,30,10,.18)');
		this.poly([s(0.16, 0.16), s(GW, 0.16), s(GW, 0.4), s(0.4, 0.4)], this.dither('rgba(60,30,10,.22)') as unknown as string);
		this.poly([s(0.16, 0.16), s(0.4, 0.4), s(0.4, GH), s(0.16, GH)], this.dither('rgba(60,30,10,.18)') as unknown as string);
		this.poly([s(0.4, 0.4), s(GW, 0.4), s(GW, 0.7), s(0.7, 0.7)], this.dither('rgba(60,30,10,.16)', 4) as unknown as string);
		this.poly([s(0.4, 0.4), s(0.7, 0.7), s(0.7, GH), s(0.4, GH)], this.dither('rgba(60,30,10,.14)', 4) as unknown as string);
		this.line([s(0, GH), s(GW, GH), s(GW, 0)], C.ink);
	}

	private sunBeam(k: number) {
		const a = (this.input.sky === 'clouds' ? 0.16 : 0.32) * k;
		const g = this.o.createLinearGradient(wL(2.3, 50).x, wL(2.3, 50).y, s(3.1, 3).x, s(3.1, 3).y);
		g.addColorStop(0, `rgba(255,226,150,${a * 1.4})`);
		g.addColorStop(1, 'rgba(255,226,150,0)');
		// Промінь — від рами вікна (d 1.15…3.45, висота 30…68) до плями на підлозі тієї ж ширини:
		// низ вікна світить ближче до стіни, верх — далі; сонце трохи збоку, тож пляма зсунута по gy.
		const d1 = 1.15, d2 = 3.45, h1 = 30, h2 = 68;
		const near = (d: number) => s(1.35, d + 0.3), far = (d: number) => s(3.1, d + 0.7);
		this.poly([wL(d1, h2), wL(d2, h2), wL(d2, h1), near(d2), far(d2), far(d1)], g as unknown as string);
		this.poly([near(d1), near(d2), far(d2), far(d1)], `rgba(255,214,130,${a})`);
		// пилинки в промені
		for (let i = 0; i < 9; i++) {
			const ph = (this.t * 0.05 + i * 0.13) % 1;
			const p = s(0.6 + ph * 3.2 + Math.sin(this.t + i) * 0.1, 1.6 + (i % 4) * 0.5);
			this.px(p.x, p.y - 20 - i * 3 + Math.sin(this.t * 0.8 + i) * 2, 1, 1, `rgba(255,245,200,${0.7 * k})`);
		}
	}

	/** Вікно: година доби й погода, глибокі відкоси, підвіконня з вазонами, штори зі складками. */
	private windowView() {
		const d1 = 1.15, d2 = 3.45, h1 = 30, h2 = 68;
		const o = this.o;
		this.qL(d1 - 0.2, d2 + 0.2, h1 - 4, h2 + 4, C.woodDk);
		this.qL(d1 - 0.14, d2 + 0.14, h1 - 3, h2 + 3, C.wood);
		o.save();
		o.beginPath();
		const w = [wL(d1, h1), wL(d2, h1), wL(d2, h2), wL(d1, h2)];
		o.moveTo(w[0].x, w[0].y); for (const p of w.slice(1)) o.lineTo(p.x, p.y); o.closePath(); o.clip();

		const [top, bottom] = this.skyColors();
		this.qL(d1, d2, h1, h2, top);
		this.qL(d1, d2, h1, h1 + 14, bottom);
		const sky = this.input.sky, n = this.night(), t = this.t;
		// дальні пагорби й дерева
		this.poly([wL(d1, h1), wL(d1, h1 + 9), wL(d1 + 0.6, h1 + 12), wL(1.9, h1 + 9), wL(2.6, h1 + 13), wL(d2, h1 + 8), wL(d2, h1)], n > 0.5 ? '#26304a' : '#7fae6a');
		for (let i = 0; i < 5; i++) { const p = wL(d1 + 0.2 + i * 0.48, h1 + 6 + (i % 2) * 3); this.px(p.x - 2, p.y - 4, 4, 5, n > 0.5 ? '#1c2438' : '#4f8a4a'); }
		if (n > 0.5 && (sky === 'clear' || sky === 'clouds')) {
			for (let i = 0; i < 14; i++) {
				const p = wL(d1 + ((i * 0.37) % 1) * (d2 - d1), h1 + 18 + ((i * 7.3) % 18));
				if ((Math.sin(t * 2 + i) + 1) / 2 > 0.25) this.px(p.x, p.y, 1, 1, '#fff6d0');
			}
			const m = wL(d2 - 0.55, h2 - 9);
			this.px(m.x - 3, m.y - 3, 6, 6, '#f4ecc8'); this.px(m.x - 1, m.y - 3, 4, 4, top);
		} else if (n < 0.5 && sky === 'clear') {
			const sp = wL(d2 - 0.5, h2 - 10);
			this.px(sp.x - 3, sp.y - 3, 6, 6, '#ffe39a'); this.px(sp.x - 2, sp.y - 2, 4, 4, '#fff3c4');
		}
		const clouds = sky === 'clear' ? 2 : sky === 'fog' ? 0 : 5;
		const cc = n > 0.5 ? 'rgba(170,180,210,.55)' : sky === 'storm' || sky === 'rain' ? 'rgba(200,205,215,.95)' : '#ffffff';
		for (let i = 0; i < clouds; i++) {
			const dd = d1 + ((t * 0.035 * (1 + i * 0.25) + i * 0.31) % 1) * (d2 - d1);
			const hh = h1 + 22 + ((i * 9) % 14);
			this.qL(dd, dd + 0.55, hh, hh + 4, cc);
			this.qL(dd + 0.15, dd + 0.45, hh + 4, hh + 7, cc);
		}
		if (sky === 'rain' || sky === 'storm') {
			for (let i = 0; i < 30; i++) {
				const p = wL(d1 + ((i * 0.173) % 1) * (d2 - d1), h2 - ((t * 70 + i * 13) % (h2 - h1)));
				this.px(p.x, p.y, 1, 3, 'rgba(190,215,240,.85)');
			}
			if (sky === 'storm' && Math.sin(t * 0.9) > 0.985) this.qL(d1, d2, h1, h2, 'rgba(255,255,255,.6)');
		}
		if (sky === 'snow') for (let i = 0; i < 24; i++) { const p = wL(d1 + ((i * 0.211) % 1) * (d2 - d1), h2 - ((t * 10 + i * 11) % (h2 - h1))); this.px(p.x, p.y, 1, 1, '#ffffff'); }
		if (sky === 'fog') this.qL(d1, d2, h1, h2, 'rgba(230,230,235,.55)');
		// відблиск на склі
		this.poly([wL(d1 + 0.2, h2), wL(d1 + 0.45, h2), wL(d1 + 0.15, h1 + 8), wL(d1 + 0.05, h1 + 8)], 'rgba(255,255,255,.18)');
		o.restore();
		// рама й імпости
		this.qL(d1, d2, 48.5, 50, C.woodLt);
		this.qL(2.25, 2.35, h1, h2, C.woodLt);
		this.line([wL(d1, h1), wL(d2, h1), wL(d2, h2), wL(d1, h2)], C.ink, 1, true);
		// підвіконня з вазончиками
		this.qL(d1 - 0.35, d2 + 0.35, h1 - 7, h1 - 3, C.woodLt);
		this.qL(d1 - 0.35, d2 + 0.35, h1 - 8, h1 - 7, C.woodDkr);
		for (const [dd, col] of [[1.55, C.leaf], [2.95, C.leafLt]] as const) {
			const p = wL(dd, h1 - 3);
			this.px(p.x - 3, p.y - 4, 6, 4, C.pot); this.px(p.x - 3, p.y - 4, 6, 1, C.potLt);
			this.px(p.x - 3, p.y - 8, 2, 4, col); this.px(p.x, p.y - 10, 2, 6, C.leafDk); this.px(p.x + 2, p.y - 8, 2, 4, col);
		}
		// штори зі складками
		for (const [a, b] of [[d1 - 0.42, d1 + 0.1], [d2 - 0.1, d2 + 0.42]]) {
			this.qL(a, b, h1 - 3, h2 + 9, '#e89aac');
			for (let k = a + 0.07; k < b; k += 0.13) this.qL(k, k + 0.05, h1 - 3, h2 + 9, '#c97488');
			this.line([wL(a, h1 - 3), wL(b, h1 - 3)], '#a85a6e');
		}
		this.qL(d1 - 0.6, d2 + 0.6, h2 + 9, h2 + 11, C.woodDkr);
		for (const dd of [d1 - 0.6, d2 + 0.6]) { const p = wL(dd, h2 + 10); this.px(p.x - 1, p.y - 2, 3, 3, C.brass); }
	}

	private skyColors(): [string, string] {
		const h = this.input.hour, sky = this.input.sky;
		const grey = sky === 'rain' || sky === 'storm' || sky === 'fog';
		if (h >= 22 || h < 5) return ['#1b2340', '#2b3766'];
		if (h < 8) return grey ? ['#8a8fa8', '#b0a8b8'] : ['#f2a47a', '#fbd59e'];
		if (h < 18) return grey ? ['#9aa6b4', '#b8c2cc'] : ['#86c8f0', '#c4e8fa'];
		return grey ? ['#6f7088', '#8f8aa0'] : ['#b874b0', '#f2a47a'];
	}

	/** Гірлянда під карнизом: теплі лампочки, вночі світяться ореолом. */
	private garland(night: number) {
		const bulbs: P[] = [];
		const sag = (f: (d: number, h: number) => P, from: number, to: number) => {
			for (let seg = from; seg < to; seg += 1) {
				const pts: P[] = [];
				for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(f(seg + u, WH - 9 - Math.sin(u * Math.PI) * 4)); }
				this.line(pts, '#3a2a20');
				for (const u of [0.25, 0.5, 0.75]) bulbs.push(f(seg + u, WH - 10 - Math.sin(u * Math.PI) * 4));
			}
		};
		sag(wL, 0, GH);
		sag(wR, 0, GW);
		bulbs.forEach((p, i) => {
			const col = C.bulb[i % C.bulb.length];
			const on = night > 0.2 ? 1 : 0.55;
			const blink = 0.75 + 0.25 * Math.sin(this.t * 2 + i * 1.3);
			if (night > 0.2) {
				const g = this.o.createRadialGradient(p.x, p.y + 2, 0, p.x, p.y + 2, 7);
				g.addColorStop(0, col.replace('#', '#') + 'aa');
				g.addColorStop(1, col + '00');
				this.o.fillStyle = g;
				this.o.globalAlpha = night * blink;
				this.o.fillRect(p.x - 7, p.y - 5, 14, 14);
				this.o.globalAlpha = 1;
			}
			this.o.globalAlpha = on;
			this.px(p.x - 1, p.y, 2, 3, col);
			this.o.globalAlpha = 1;
			this.px(p.x - 1, p.y - 1, 2, 1, '#3a2a20');
		});
	}

	private nightTint(k: number) {
		this.poly(this.room(), `rgba(22,16,52,${0.55 * k})`);
		const o = this.o;
		o.globalCompositeOperation = 'lighter';
		const glow = (p: P, rad: number, a: number, rgb = '255,170,80') => {
			const g = o.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad);
			g.addColorStop(0, `rgba(${rgb},${a * k})`);
			g.addColorStop(0.5, `rgba(${rgb},${a * k * 0.35})`);
			g.addColorStop(1, `rgba(${rgb},0)`);
			o.fillStyle = g;
			o.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
		};
		glow(at(3.4, 4.4, 15), 70, 0.42);
		glow(at(3.4, 4.4, 36), 22, 0.5, '255,210,140');
		glow(at(0.35, 3.25, 34), 52, 0.5);
		for (const r of ROLES) { const d = DESKS[r]; glow(at(d.gx + 0.7, d.gy + 0.45, DESK_H + 7), 20, 0.35, '120,230,190'); }
		glow(at(6.8, 4.3, 30), 26, 0.25, '255,190,120');
		o.globalCompositeOperation = 'source-over';
	}

	/** Лампа-абажур над столом переговорів: світиться вечорами. */
	private pendant(night: number) {
		const p = at(3.4, 4.4, 38);
		this.px(p.x, p.y - 48, 1, 41, '#3a2a20');
		this.poly([{ x: p.x - 9, y: p.y }, { x: p.x + 9, y: p.y }, { x: p.x + 4, y: p.y - 7 }, { x: p.x - 4, y: p.y - 7 }], '#2f5a4a');
		this.poly([{ x: p.x - 9, y: p.y }, { x: p.x + 9, y: p.y }, { x: p.x + 7, y: p.y - 2 }, { x: p.x - 7, y: p.y - 2 }], '#3f7a64');
		this.line([{ x: p.x - 9, y: p.y }, { x: p.x + 9, y: p.y }, { x: p.x + 4, y: p.y - 7 }, { x: p.x - 4, y: p.y - 7 }], C.ink, 1, true);
		this.px(p.x - 3, p.y + 1, 7, 2, night > 0.2 ? '#ffe7a8' : '#d8c08a');
	}

	/** Теплий колірний тон Stardew і мʼяка віньєтка. */
	private room(): P[] {
		const f = s(GW, GH), l = s(0, GH), r = s(GW, 0);
		return [{ x: l.x, y: l.y - WH }, { x: OX, y: OY - WH }, { x: r.x, y: r.y - WH }, r, f, l];
	}

	private grade(night: number) {
		this.poly(this.room(), `rgba(255,170,90,${0.05 * (1 - night)})`);
	}

	/* ─────────── настінне ─────────── */
	private decor() {
		// двері
		this.qL(4.5, 5.75, 0, 52, C.doorDk);
		this.qL(4.6, 5.65, 0, 49, C.door);
		this.qL(4.75, 5.08, 28, 44, C.doorDk); this.qL(5.18, 5.5, 28, 44, C.doorDk);
		this.qL(4.75, 5.08, 6, 24, C.doorDk); this.qL(5.18, 5.5, 6, 24, C.doorDk);
		this.qL(4.79, 5.04, 29, 43, C.doorLt); this.qL(5.22, 5.46, 29, 43, C.doorLt);
		const kn = wL(5.55, 24); this.px(kn.x - 1, kn.y - 1, 2, 2, C.brass);
		this.line([wL(4.5, 0), wL(4.5, 52), wL(5.75, 52), wL(5.75, 0)], C.ink);
		// коркова дошка з чотирма слотами пакета (папірці на шпильках)
		const b1 = 0.9, b2 = 4.0, bh1 = 33, bh2 = 70;
		this.qR(b1 - 0.16, b2 + 0.16, bh1 - 3, bh2 + 3, C.woodDk);
		this.qR(b1, b2, bh1, bh2, C.cork);
		for (let i = 0; i < 40; i++) { const p = wR(b1 + hash(i, 1) * (b2 - b1), bh1 + hash(i, 2) * (bh2 - bh1)); this.px(p.x, p.y, 1, 1, C.corkDk); }
		this.line([wR(b1 - 0.16, bh1 - 3), wR(b2 + 0.16, bh1 - 3), wR(b2 + 0.16, bh2 + 3), wR(b1 - 0.16, bh2 + 3)], C.ink, 1, true);
		const slots: [keyof SceneInput['board'], number, number, number, number, string][] = [
			['positioning', b1 + 0.15, b1 + 1.45, bh2 - 17, bh2 - 3, '#ffe9a8'],
			['name', b1 + 1.65, b2 - 0.15, bh2 - 17, bh2 - 3, '#cfe6ff'],
			['slogan', b1 + 0.15, b1 + 1.45, bh1 + 3, bh1 + 16, '#ffd0d8'],
			['logo', b1 + 1.65, b2 - 0.15, bh1 + 3, bh1 + 16, '#d8f2c8']
		];
		for (const [k, d1, d2, h1, h2, col] of slots) {
			if (this.input.board[k]) {
				this.qR(d1 + 0.05, d2 + 0.05, h1 - 1, h2 - 1, 'rgba(60,30,10,.25)');
				this.qR(d1, d2, h1, h2, col);
				if (k === 'logo' && this.input.logo) {
					const pa = this.input.logo.palette;
					this.qR(d1 + 0.4, d2 - 0.4, h1 + 2, h2 - 3, pa.a);
					this.qR(d1 + 0.6, d2 - 0.6, h1 + 4, h2 - 5, pa.b);
				} else for (let i = 0; i < 3; i++) this.qR(d1 + 0.12, d2 - 0.2 - (i % 2) * 0.35, h2 - 5 - i * 3, h2 - 4 - i * 3, 'rgba(70,50,40,.55)');
				const pin = wR((d1 + d2) / 2, h2 - 1); this.px(pin.x - 1, pin.y - 1, 2, 2, '#d8433a');
			} else {
				for (let i = 0; i < 10; i++) { const u = i / 10; this.px(wR(d1 + u * (d2 - d1), h1).x, wR(d1 + u * (d2 - d1), h1).y, 1, 1, 'rgba(255,255,255,.45)'); this.px(wR(d1 + u * (d2 - d1), h2).x, wR(d1 + u * (d2 - d1), h2).y, 1, 1, 'rgba(255,255,255,.45)'); }
			}
		}
		this.shelf(5.0, 7.45, 32, 3);
		this.flag(5.2, 6.7, 70, this.t);
		this.poster(6.9, 7.48, 46, 68);
		// годинник
		const cc = wR(4.7, 66);
		this.px(cc.x - 5, cc.y - 5, 10, 10, C.woodDkr); this.px(cc.x - 4, cc.y - 4, 8, 8, '#fff7e4');
		this.px(cc.x - 5, cc.y - 2, 1, 4, C.woodDkr); this.px(cc.x + 4, cc.y - 2, 1, 4, C.woodDkr);
		const hr = (this.input.hour % 12) / 12 * Math.PI * 2, mn = (this.input.hour % 1) * Math.PI * 2;
		this.line([cc, { x: cc.x + Math.sin(mn) * 3.5, y: cc.y - Math.cos(mn) * 3.5 }], '#3a2a20');
		this.line([cc, { x: cc.x + Math.sin(hr) * 2.2, y: cc.y - Math.cos(hr) * 2.2 }], '#c8463a');
		// картинка над кріслом
		this.qL(3.75, 4.35, 44, 60, C.woodDkr); this.qL(3.8, 4.3, 45, 59, '#9fd0e8');
		this.poly([wL(3.8, 45), wL(4.3, 45), wL(4.3, 50), wL(4.05, 54), wL(3.8, 49)], '#6fae5e');
	}

	/** Прапор України: повішений за два кути, провисає й хвилюється, не рівний прямокутник. */
	private flag(d1: number, d2: number, top: number, t: number) {
		const steps = 40, band = 8;
		for (let i = 0; i < steps; i++) {
			const u = i / steps, u2 = (i + 1) / steps;
			const dd = d1 + u * (d2 - d1), dd2 = d1 + u2 * (d2 - d1);
			const sag = Math.sin(u * Math.PI) * 2.5;
			const wave = Math.sin(u * Math.PI * 3 + t * 1.6) * 1.2;
			const y0 = top - sag + wave;
			const shade = Math.cos(u * Math.PI * 3 + t * 1.6);
			const blue = shade > 0.35 ? '#2a6ccc' : shade < -0.35 ? '#003f8a' : '#0057b7';
			const yel = shade > 0.35 ? '#ffe34d' : shade < -0.35 ? '#e0b800' : '#ffd700';
			this.qR(dd, dd2 + 0.004, y0 - band, y0, blue);
			this.qR(dd, dd2 + 0.004, y0 - band * 2 - Math.max(0, -wave * 0.4), y0 - band, yel);
		}
		for (const dd of [d1, d2]) { const p = wR(dd, top); this.px(p.x - 1, p.y - 1, 2, 2, '#9aa1ab'); }
		this.line([wR(d1, top), wR(d2, top)], 'rgba(40,20,10,.25)');
	}

	/** Абстрактний плакат на скотчі. */
	private poster(d1: number, d2: number, h1: number, h2: number) {
		this.qR(d1 + 0.03, d2 + 0.03, h1 - 1, h2 - 1, 'rgba(60,30,10,.2)');
		this.qR(d1, d2, h1, h2, '#f6efe0');
		this.poly([wR(d1 + 0.08, h1 + 3), wR(d2 - 0.06, h1 + 3), wR(d1 + 0.3, h1 + 14)], '#2f7f86');
		const c = wR(d1 + 0.34, h2 - 8); this.px(c.x - 4, c.y - 4, 8, 8, '#e07a4a'); this.px(c.x - 3, c.y - 5, 6, 1, '#e07a4a'); this.px(c.x - 3, c.y + 4, 6, 1, '#e07a4a');
		for (let i = 0; i < 3; i++) this.qR(d1 + 0.06, d2 - 0.1 - i * 0.08, h1 + 16 + i * 2.5, h1 + 17 + i * 2.5, '#2b2420');
		for (const dd of [d1 - 0.03, d2 - 0.1]) this.qR(dd, dd + 0.13, h2 - 2, h2 + 1.5, 'rgba(240,226,180,.85)');
	}

	private shelf(d1: number, d2: number, h: number, seed: number) {
		this.qR(d1 - 0.1, d2 + 0.1, h, h + 3, C.woodTop);
		this.qR(d1 - 0.1, d2 + 0.1, h - 2, h, C.woodDkr);
		for (const dd of [d1 + 0.15, d2 - 0.15]) this.qR(dd - 0.04, dd + 0.04, h - 6, h, C.woodDkr);
		let d = d1;
		let i = seed;
		while (d < d2 - 0.2) {
			i++;
			const kind = hash(i, 5);
			if (kind > 0.86) {
				// вазончик
				const p = wR(d + 0.2, h + 3);
				this.px(p.x - 3, p.y - 5, 6, 5, C.pot); this.px(p.x - 3, p.y - 5, 6, 1, C.potLt);
				this.px(p.x - 4, p.y - 9, 3, 4, C.leaf); this.px(p.x - 1, p.y - 11, 2, 6, C.leafDk); this.px(p.x + 1, p.y - 9, 3, 4, C.leafLt);
				if (h > 45) for (let k = 0; k < 4; k++) this.px(p.x + 2 + (k % 2), p.y - 1 + k * 3, 2, 3, k % 2 ? C.leaf : C.leafDk);
				d += 0.42;
				continue;
			}
			const w = 0.09 + hash(i, 9) * 0.07;
			const bh = 9 + Math.floor(hash(i, 4) * 5);
			const col = C.book[Math.floor(hash(i, 2) * C.book.length)];
			this.qR(d, d + w, h + 3, h + 3 + bh, col);
			this.qR(d, d + w, h + 3 + bh - 1, h + 3 + bh, 'rgba(255,255,255,.3)');
			this.qR(d, d + w, h + 6, h + 7, 'rgba(255,220,140,.6)');
			this.line([wR(d + w, h + 3), wR(d + w, h + 3 + bh)], 'rgba(40,20,10,.5)');
			d += w + 0.01;
		}
	}

	/* ─────────── обʼєкти з сортуванням по глибині ─────────── */
	private objects() {
		this.rug();
		const list: { depth: number; fn: () => void }[] = [];
		const add = (depth: number, fn: () => void) => list.push({ depth, fn });
		add(0.6, () => this.bigPlant(0.4, 0.4, 1.1));
		add(GW - 0.1, () => this.bigPlant(GW - 0.45, 0.4, 0.9));
		add(0.15 + 3.6 + 0.8 + 0.8, () => this.armchair(0.15, 3.6));
		add(0.35 + 3.25 + 0.2, () => this.floorLamp(0.35, 3.25));
		for (const r of ROLES) {
			const d = DESKS[r], sp = SPOTS[r].desk;
			// Порядок: стіл → сидіння → людина → спинка крісла (вона між нами й людиною).
			add(d.gx + d.gy + DESK_D + 0.4, () => this.desk(r, d.gx, d.gy));
			add(sp.gx + sp.gy - 0.3, () => this.chairSeat(r, sp.gx, sp.gy));
			add(sp.gx + sp.gy + 0.3, () => this.chairBack(r, sp.gx, sp.gy));
		}
		for (const k of ['strategist', 'copywriter', 'designer', 'client'] as SpriteId[]) {
			if (k === 'client' && !this.input.clientInOffice && this.pos.client.gx === CLIENT_DOOR.gx) continue;
			const c = this.pos[k];
			if (k !== 'client' && this.input.away && Math.hypot(c.gx - SPOTS.strategist.away.gx, c.gy - SPOTS.strategist.away.gy) < 0.25) continue;
			// у кріслі біля вікна людина сидить поверх сидіння
			const inArmchair = k !== 'client' && Math.hypot(c.gx - ARMCHAIR.gx, c.gy - ARMCHAIR.gy) < 0.05;
			add(c.gx + c.gy + (inArmchair ? 1.3 : 0), () => this.sprite(k));
		}
		// Глибина столу — по його центру: хто стоїть спереду (клієнт, дизайнер), малюється поверх, хто ззаду — під ним.
		add(2.2 + 3.6 + 1.2 + 0.8, () => this.meetingTable(2.2, 3.6));
		add(6.5 + 3.9 + 1.4 + 1.05, () => this.coffeeCorner(6.5, 3.9));
		add(2.9 + 5.05, () => this.cat(2.9, 5.05));
		add(7.4 + 2.6, () => { this.shadowUnder(7.3, 2.35, 0.62, 0.62); this.box(7.3, 2.35, 0.62, 0.62, 13, '#d9b98c', '#b4936a', '#a17f58'); this.qH(7.3, 2.62, 7.92, 2.7, 13, '#c8a26a'); });
		list.sort((a, b) => a.depth - b.depth).forEach((o) => o.fn());
		if (this.input.gptFor) this.gptHologram(this.input.gptFor);
	}

	private rug() {
		this.qF(1.9, 3.3, 5.1, 5.7, C.rugEdge);
		this.qF(1.98, 3.38, 5.02, 5.62, C.rug);
		this.qF(2.25, 3.65, 4.75, 5.35, C.rugIn);
		this.qF(2.45, 3.85, 4.55, 5.15, C.rug);
		// ромби в облямівці
		for (let gx = 2.1; gx < 5.0; gx += 0.36) for (const gy of [3.51, 5.49]) { const p = s(gx, gy); this.px(p.x - 1, p.y - 1, 3, 2, C.rugPat); }
		for (let gy = 3.6; gy < 5.4; gy += 0.36) for (const gx of [2.11, 4.89]) { const p = s(gx, gy); this.px(p.x - 1, p.y - 1, 3, 2, C.rugPat); }
		// бахрома
		for (let gy = 3.35; gy < 5.7; gy += 0.12) { const p = s(5.1, gy); this.px(p.x, p.y, 2, 1, '#f2d9b0'); const q = s(1.9, gy); this.px(q.x - 2, q.y, 2, 1, '#f2d9b0'); }
	}

	/** Офісне крісло як у референсі: бузкові подушки з темним кантом, сірий газліфт, хрестовина з коліщатами. */
	private chairSeat(_r: Role, cx: number, cy: number) {
		const P = { pad: '#b9bff2', padHi: '#e2e5ff', padLo: '#7f86d6', metal: '#9aa0b4', metalLo: '#5f6578', ink: '#151a22' };
		// хрестовина: чотири промені й коліщата
		for (const [dx, dy] of [[-0.22, 0], [0.22, 0], [0, -0.2], [0, 0.2]] as const) {
			this.line([at(cx, cy, 1), at(cx + dx, cy + dy, 1)], P.metalLo, 2);
			const w = at(cx + dx, cy + dy, 0);
			this.px(w.x - 1, w.y - 1, 3, 2, P.ink);
		}
		const pole = at(cx, cy, 1);
		this.px(pole.x - 1, pole.y - 7, 2, 7, P.metal);
		this.px(pole.x, pole.y - 7, 1, 7, P.metalLo);
		// сидіння: тонка подушка
		this.boxAt(cx - 0.2, cy - 0.18, 0.4, 0.36, 7, 9, P.pad, P.padLo, P.padLo, P.padHi, P.ink);
	}
	/** Спинка з нашого боку: овальна подушка на тонкій ніжці. */
	private chairBack(_r: Role, cx: number, cy: number) {
		const P = { pad: '#b9bff2', padHi: '#e2e5ff', padLo: '#7f86d6', metal: '#5f6578', ink: '#151a22' };
		const st = at(cx, cy + 0.2, 9);
		this.px(st.x - 1, st.y - 3, 2, 3, P.metal);
		const gx = cx - 0.17, gy = cy + 0.2;
		this.qFace(gx, gx + 0.34, gy, 11, 19, P.pad);
		this.qFace(gx, gx + 0.04, gy, 11, 19, P.padHi);
		this.qFace(gx + 0.28, gx + 0.34, gy, 11, 19, P.padLo);
		this.qFace(gx, gx + 0.34, gy, 11, 12, P.padLo);
		this.line([at(gx, gy, 11), at(gx, gy, 19), at(gx + 0.34, gy, 19), at(gx + 0.34, gy, 11)], P.ink, 1, true);
	}

	private desk(r: Role, gx: number, gy: number) {
		const w = DESK_W, d = DESK_D, h = DESK_H;
		this.shadowUnder(gx, gy, w, d);
		this.box(gx, gy, w, d, h, C.woodTop, C.wood, C.woodDk);
		// ящики на передній грані
		for (const [a, b] of [[0.08, 0.7], [0.85, 1.47]]) {
			this.qFace(gx + a, gx + b, gy + d, 3, h - 3, C.woodTop);
			this.qFace(gx + a + 0.02, gx + b - 0.02, gy + d, 4, h - 4, C.wood);
			this.line([at(gx + a, gy + d, 9.5), at(gx + b, gy + d, 9.5)], C.woodDkr);
			const hp = at(gx + (a + b) / 2, gy + d, 12.5); this.px(hp.x - 1, hp.y, 3, 1, C.brass);
			const hp2 = at(gx + (a + b) / 2, gy + d, 6.5); this.px(hp2.x - 1, hp2.y, 3, 1, C.brass);
		}
		// техніка дивиться екраном на людину за столом — глядач бачить кришки зі спини
		const asking = this.input.gptFor === r;
		if (r === 'designer') this.monitor(gx + 0.12, gy + 0.12, h, asking);
		this.macbook(r === 'designer' ? gx + 0.8 : gx + 0.5, gy + 0.42, h, asking);
		// папери, кружка, олівці
		this.qH(gx + 0.12, gy + 0.55, gx + 0.44, gy + 0.82, h + 0.4, C.paper);
		this.qH(gx + 0.15, gy + 0.52, gx + 0.47, gy + 0.79, h + 1, C.paperDk);
		this.qH(gx + 0.17, gy + 0.54, gx + 0.45, gy + 0.77, h + 1.4, C.paper);
		this.mug(gx + 1.32, gy + 0.66, h);
		const pc = at(gx + 1.38, gy + 0.3, h); this.px(pc.x - 2, pc.y - 4, 4, 4, '#5a6fa8'); this.px(pc.x - 1, pc.y - 7, 1, 3, '#f0c23b'); this.px(pc.x + 1, pc.y - 6, 1, 2, '#c8463a');
		if (r === 'strategist') this.smallPlant(gx + 1.2, gy + 0.78, h);
		if (r === 'copywriter') { const st = at(gx + 1.1, gy + 0.72, h); this.px(st.x - 3, st.y - 2, 6, 2, '#f0c23b'); this.px(st.x - 2, st.y - 3, 5, 1, '#ffd77a'); }
	}

	/** MacBook: тонка основа, кришка на задньому краї — екран дивиться на людину перед столом і на нас. */
	private macbook(gx: number, gy: number, h: number, glow: boolean) {
		const w = 0.42, d = 0.26;
		// кришка-екран на задньому краї
		this.qFace(gx + 0.01, gx + w - 0.01, gy, h + 1, h + 10, '#b9c0c9');
		this.qFace(gx + 0.04, gx + w - 0.04, gy, h + 2, h + 9, glow ? '#1f8f7a' : '#26323a');
		const on = glow ? C.gpt : C.screenOn;
		for (let i = 0; i < 3; i++) this.qFace(gx + 0.07, gx + 0.07 + 0.1 + ((i * 7) % 4) * 0.04, gy, h + 7 - i * 1.6, h + 7.7 - i * 1.6, on);
		this.line([at(gx + 0.01, gy, h + 1), at(gx + w - 0.01, gy, h + 1), at(gx + w - 0.01, gy, h + 10), at(gx + 0.01, gy, h + 10)], C.ink, 1, true);
		// основа з клавіатурою
		this.qH(gx, gy, gx + w, gy + d, h + 1, '#c9ced6');
		this.qH(gx + 0.04, gy + 0.03, gx + w - 0.04, gy + 0.15, h + 1.2, '#9aa1ab');
		this.qFace(gx, gx + w, gy + d, h, h + 1, '#8f96a0');
	}

	/** Монітор дизайнера: екран до нас, на ньому макет. */
	private monitor(gx: number, gy: number, h: number, glow: boolean) {
		const w = 0.6;
		this.qH(gx + 0.2, gy + 0.04, gx + 0.4, gy + 0.2, h + 0.6, '#3a3f46');
		this.qFace(gx + 0.27, gx + 0.33, gy + 0.12, h, h + 6, '#2c3036');
		this.qFace(gx, gx + w, gy + 0.12, h + 5, h + 18, '#2c3036');
		this.qFace(gx + 0.03, gx + w - 0.03, gy + 0.12, h + 6, h + 17, glow ? '#1f8f7a' : '#f2ead8');
		if (!glow) {
			this.qFace(gx + 0.08, gx + 0.3, gy + 0.12, h + 9, h + 15, '#d98a63');
			this.qFace(gx + 0.34, gx + 0.54, gy + 0.12, h + 13, h + 15, '#2b2420');
			this.qFace(gx + 0.34, gx + 0.5, gy + 0.12, h + 10, h + 11, '#9aa1ab');
		}
		this.line([at(gx, gy + 0.12, h + 5), at(gx + w, gy + 0.12, h + 5), at(gx + w, gy + 0.12, h + 18), at(gx, gy + 0.12, h + 18)], C.ink, 1, true);
	}

	/** Кружка як у піксель-референсі: біла з блакитною тінню, темна кава зверху, вушко. */
	private mug(gx: number, gy: number, base: number) {
		const p = s(gx, gy), x = p.x - 3, y = p.y - base - 6;
		this.px(x, y, 6, 6, '#eef1f8');
		this.px(x + 4, y + 1, 2, 5, '#b9c2d8');
		this.px(x, y, 6, 1, '#ffffff');
		this.px(x + 1, y, 4, 1, '#4a2412');
		this.px(x + 6, y + 1, 2, 1, '#b9c2d8'); this.px(x + 7, y + 2, 1, 2, '#b9c2d8'); this.px(x + 6, y + 4, 2, 1, '#b9c2d8');
		this.px(x, y + 5, 6, 1, '#9aa3bc');
		this.line([{ x: x - 0.5, y: y }, { x: x - 0.5, y: y + 6 }], 'rgba(40,30,40,.5)');
	}

	private smallPlant(gx: number, gy: number, base: number) {
		const p = at(gx, gy, base);
		this.px(p.x - 2, p.y - 4, 5, 4, C.potLt); this.px(p.x - 2, p.y - 4, 5, 1, '#f2b089');
		this.px(p.x - 3, p.y - 8, 3, 4, C.leaf); this.px(p.x, p.y - 10, 2, 6, C.leafDk); this.px(p.x + 1, p.y - 7, 3, 3, C.leafLt);
	}

	private bigPlant(gx: number, gy: number, sc: number) {
		const p = s(gx, gy);
		const pw = Math.round(10 * sc), ph = Math.round(9 * sc);
		this.poly([{ x: p.x, y: p.y + 2 }, { x: p.x + 9, y: p.y - 2 }, { x: p.x, y: p.y - 5 }, { x: p.x - 9, y: p.y - 2 }], 'rgba(60,30,15,.22)');
		this.px(p.x - pw / 2, p.y - ph, pw, ph, C.pot);
		this.px(p.x - pw / 2, p.y - ph, 2, ph, C.potLt);
		this.px(p.x - pw / 2 - 1, p.y - ph - 2, pw + 2, 3, C.potDk);
		this.px(p.x - pw / 2 - 1, p.y - ph - 2, pw + 2, 1, C.potLt);
		// стовбур і великі листки в три тони з темною обводкою
		this.px(p.x, p.y - ph - 18 * sc, 1, 18 * sc, C.woodDk);
		const leaves: [number, number, number, number][] = [[-7, -12, 0, -1], [6, -14, 1, 1], [-6, -22, 2, -1], [7, -24, 0, 1], [-1, -33, 1, 0], [-8, -30, 2, -1], [5, -32, 0, 1], [0, -20, 1, 1]];
		for (const [lx, ly, tone, dir] of leaves) this.leaf(p.x + lx * sc, p.y - ph + ly * sc, dir, tone, sc);
	}

	/** Загострений листок: тон, жилка, темна обводка. dir: −1 вліво, 1 вправо, 0 угору. */
	private leaf(x: number, y: number, dir: number, tone: number, sc = 1) {
		const L = 6 * sc, W = 2.6 * sc;
		const tip = dir === 0 ? { x, y: y - L } : { x: x + dir * L, y: y - L * 0.35 };
		const pts = dir === 0
			? [{ x: x - W, y }, tip, { x: x + W, y }, { x, y: y + 1.5 }]
			: [{ x, y: y - W }, tip, { x, y: y + W }, { x: x - dir * 1.5, y }];
		this.poly(pts, tone === 0 ? C.leafDk : tone === 1 ? C.leaf : C.leafLt);
		this.line([{ x, y }, tip], tone === 2 ? C.leaf : C.leafLt);
		this.line([...pts, pts[0]], C.leafInk);
	}

	private armchair(gx: number, gy: number) {
		this.shadowUnder(gx, gy, 0.8, 0.8);
		this.box(gx, gy, 0.8, 0.8, 9, C.sofa, C.sofaDk, C.sofaDk);
		this.box(gx, gy, 0.16, 0.8, 22, C.sofaLt, C.sofaDk, C.sofa);
		this.box(gx + 0.16, gy, 0.64, 0.16, 15, C.sofaLt, C.sofa, C.sofaDk);
		this.box(gx + 0.16, gy + 0.64, 0.64, 0.16, 15, C.sofaLt, C.sofa, C.sofaDk);
		this.qH(gx + 0.22, gy + 0.2, gx + 0.74, gy + 0.6, 10, '#b86a7c');
		// плед і книжка
		this.qH(gx + 0.4, gy + 0.18, gx + 0.7, gy + 0.62, 10.5, '#e8c27a');
		for (let k = gy + 0.22; k < gy + 0.6; k += 0.1) this.qH(gx + 0.4, k, gx + 0.7, k + 0.03, 10.7, '#c8463a');
	}

	private floorLamp(gx: number, gy: number) {
		const p = s(gx, gy);
		this.px(p.x - 3, p.y - 1, 6, 2, C.woodDkr);
		this.px(p.x, p.y - 30, 1, 29, C.woodDkr);
		this.poly([{ x: p.x - 6, y: p.y - 30 }, { x: p.x + 6, y: p.y - 30 }, { x: p.x + 4, y: p.y - 38 }, { x: p.x - 4, y: p.y - 38 }], '#f2d69a');
		this.line([{ x: p.x - 6, y: p.y - 30 }, { x: p.x + 6, y: p.y - 30 }, { x: p.x + 4, y: p.y - 38 }, { x: p.x - 4, y: p.y - 38 }], C.ink, 1, true);
		this.px(p.x - 5, p.y - 31, 10, 1, '#d9b06a');
	}

	private meetingTable(gx: number, gy: number) {
		const w = 2.4, d = 1.6, h = 15;
		this.shadowUnder(gx, gy, w, d);
		this.box(gx + w / 2 - 0.16, gy + d / 2 - 0.16, 0.32, 0.32, h - 2, C.woodDk, C.woodDkr, C.woodDkr, false);
		this.box(gx, gy, w, d, h, C.woodTop, C.wood, C.woodDk);
		// волокна стільниці
		for (let i = 0; i < 8; i++) { const p = at(gx + 0.2 + hash(i, 11) * 2, gy + 0.2 + hash(i, 12) * 1.2, h); this.px(p.x, p.y, 3, 1, '#b67c48'); }
		this.qH(gx + 0.3, gy + 0.3, gx + 0.95, gy + 0.78, h + 0.4, C.paper);
		for (let i = 0; i < 3; i++) this.qH(gx + 0.38, gy + 0.4 + i * 0.12, gx + 0.85, gy + 0.44 + i * 0.12, h + 0.8, '#b8ad98');
		this.pizza(gx + 1.15, gy + 0.5, h);
		this.mug(gx + 2.05, gy + 0.42, h);
		this.mug(gx + 0.55, gy + 1.25, h);
		// ваза з квітами
		const v = at(gx + 1.0, gy + 1.25, h);
		this.px(v.x - 2, v.y - 6, 4, 6, '#7ba7d4'); this.px(v.x - 2, v.y - 6, 1, 6, '#a9c8e8');
		for (const [fx, fy, col] of [[-3, -10, '#f2a0b8'], [1, -12, '#ffd27a'], [3, -9, '#f6f2ea'], [-1, -14, '#e0546a']] as const) { this.px(v.x + fx, v.y + fy, 2, 2, col); this.px(v.x + fx, v.y + fy + 2, 1, 3, C.leafDk); }
	}

	/** Відкрита коробка піци на столі: пласке дно, піца з одним з'їденим шматком, кришка відкинута назад. */
	private pizza(bx: number, by: number, h: number) {
		const w = 0.66, d = 0.66, t = 2;
		// кришка стоїть вертикально на задньому краї
		this.qFace(bx, bx + w, by, h + t, h + t + 15, '#e6cfa0');
		this.qFace(bx + 0.04, bx + w - 0.04, by, h + t + 1, h + t + 14, '#dcc08c');
		this.qFace(bx + 0.18, bx + 0.32, by, h + t + 6, h + t + 9, 'rgba(160,110,50,.35)');
		this.line([at(bx, by, h + t), at(bx, by, h + t + 15), at(bx + w, by, h + t + 15), at(bx + w, by, h + t)], C.ink);
		// дно-лоток
		this.qFace(bx, bx + w, by + d, h, h + t, '#c9a86e');
		this.qSide(bx + w, by, by + d, h, h + t, '#b8955c');
		this.qH(bx, by, bx + w, by + d, h + t, '#d9bf8a');
		this.line([at(bx, by + d, h + t), at(bx + w, by + d, h + t), at(bx + w, by, h + t), at(bx + w, by, h), at(bx + w, by + d, h), at(bx, by + d, h), at(bx, by + d, h + t)], C.ink);
		// піца: коло на площині лотка, скоринка й сир
		const cx = bx + w / 2, cy = by + d / 2, z = h + t + 0.4;
		const ring = (r: number, from = 0, to = Math.PI * 2) => {
			const pts: P[] = [];
			for (let k = 0; k <= 16; k++) { const a = from + ((to - from) * k) / 16; pts.push(at(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); }
			return pts;
		};
		this.poly(ring(0.31), '#8a4a22');
		this.poly(ring(0.29), '#e0a060');
		this.poly(ring(0.25), '#d0553a');
		this.poly(ring(0.23), '#f5c64e');
		// нарізка
		for (const ang of [0.4, 1.45, 2.5, 3.55, 4.6, 5.65]) { const e = at(cx + Math.cos(ang) * 0.22, cy + Math.sin(ang) * 0.22, z); this.line([at(cx, cy, z), e], 'rgba(200,140,40,.7)'); }
		// пепероні з відблиском
		for (const [dx, dy] of [[-0.11, -0.07], [0.08, -0.11], [0.12, 0.05], [-0.03, 0.12], [-0.13, 0.06], [0.0, 0.0]] as const) {
			const p = at(cx + dx, cy + dy, z);
			this.px(p.x - 1, p.y - 1, 3, 2, '#b02a24'); this.px(p.x - 1, p.y - 1, 1, 1, '#e0655a');
		}
		// з'їдений шматок: клин лотка поверх піци
		this.poly([at(cx, cy, z + 0.1), ...ring(0.32, -0.3, 0.6).map((p) => ({ x: p.x, y: p.y - 0.1 }))], '#d9bf8a');
	}

	private coffeeCorner(gx: number, gy: number) {
		const CH = 18;
		this.shadowUnder(gx, gy, 1.4, 1.05);
		this.box(gx, gy, 1.4, 1.05, CH, C.woodTop, C.wood, C.woodDk);
		for (const [a, b] of [[0.06, 0.66], [0.74, 1.34]]) {
			this.qFace(gx + a, gx + b, gy + 1.05, 3, CH - 3, C.woodTop);
			this.qFace(gx + a + 0.03, gx + b - 0.03, gy + 1.05, 4, CH - 4, C.wood);
			const k = at(gx + (a > 0.5 ? a + 0.08 : b - 0.08), gy + 1.05, 10); this.px(k.x, k.y, 1, 2, C.brass);
		}
		this.qH(gx + 0.04, gy + 0.04, gx + 1.36, gy + 1.01, CH + 0.5, '#e8dcc0');
		// крапельна кавоварка: сланцевий корпус зі світлими гранями, бак позаду, головка над колбою
		const mx = gx + 0.16, my = gy + 0.18, mw = 0.46, md = 0.46, z = CH;
		const K = { top: '#5d5776', right: '#26223a', front: '#3a3553', hi: '#a19cbd', ink: '#141222' };
		this.boxAt(mx, my, mw, md, z, z + 3, K.top, K.right, K.front, K.hi, K.ink);
		this.boxAt(mx, my, mw, 0.2, z + 3, z + 22, K.top, K.right, K.front, K.hi, K.ink);
		// колба на плиті під головкою
		const c0 = at(mx + 0.22, my + 0.34, z + 3);
		const level = Math.max(0, Math.min(1, this.input.coffee ?? 0));
		this.px(c0.x - 5, c0.y - 11, 10, 11, 'rgba(205,215,235,.55)');
		this.px(c0.x - 5, c0.y - 11, 10, 1, '#2a2640');
		const fill = Math.round(level * 8);
		if (fill) {
			this.px(c0.x - 5, c0.y - fill, 10, fill, '#4a2412');
			this.px(c0.x - 5, c0.y - fill, 10, 1, '#c4743c');
			this.px(c0.x - 4, c0.y - fill + 1, 2, Math.max(1, fill - 2), '#7a4a2a');
		}
		this.px(c0.x - 4, c0.y - 10, 1, 8, 'rgba(255,255,255,.75)');
		this.px(c0.x + 5, c0.y - 9, 2, 1, '#2a2640'); this.px(c0.x + 6, c0.y - 9, 1, 5, '#2a2640'); this.px(c0.x + 5, c0.y - 5, 2, 1, '#2a2640');
		this.line([{ x: c0.x - 6, y: c0.y }, { x: c0.x - 6, y: c0.y - 11 }], K.ink);
		this.line([{ x: c0.x + 5, y: c0.y }, { x: c0.x + 5, y: c0.y - 11 }], K.ink);
		// поки вариться — крапля з фільтра
		if (level > 0 && level < 1) { const dy = Math.floor((this.t * 6) % 3); this.px(c0.x, c0.y - 12 + dy, 1, 1, '#4a2412'); }
		this.boxAt(mx, my, mw, md, z + 22, z + 28, K.top, K.right, K.front, K.hi, K.ink);
		// кнопки на основі: синя й помаранчева
		const bt = at(mx + 0.1, my + md, z + 1.5);
		this.px(bt.x - 1, bt.y - 1, 2, 2, '#2f78d0'); this.px(bt.x + 3, bt.y, 2, 1, '#d98a3a');
		// пара — лише коли кава є
		for (let i = 0; i < (level > 0 ? 3 : 0); i++) {
			const ph = (this.t * 0.5 + i * 0.33) % 1;
			const p = at(mx + 0.3, my + 0.25, z + 29 + ph * 12);
			this.o.globalAlpha = (1 - ph) * 0.55;
			this.px(p.x + Math.sin(ph * 7 + i * 1.7) * 2 - 1, p.y, 2, 2, '#ffffff');
		}
		this.o.globalAlpha = 1;
		// банки з кавою й печивом
		const j = at(gx + 1.05, gy + 0.3, CH);
		this.px(j.x - 2, j.y - 7, 5, 7, '#e8e0cc'); this.px(j.x - 2, j.y - 8, 5, 2, '#a86a3a'); this.px(j.x - 1, j.y - 5, 3, 3, '#6b4226');
		this.mug(gx + 1.2, gy + 0.74, CH + 0.5);
		this.bigPlant(gx + 0.26, gy + 1.42, 0.7);
	}

	/** Рудий кіт клубочком, прокидається, коли в офісі клієнт. */
	private cat(gx: number, gy: number) {
		const p = s(gx, gy);
		const awake = this.input.clientInOffice;
		const br = Math.round(Math.sin(this.t * 2.2) * 0.6);
		const pal: Record<string, string> = { o: '#7a3a18', O: '#f0a050', e: awake ? '#3a8a3a' : '#5a2a10', n: '#e07a8a', t: '#c87030' };
		const x0 = Math.round(p.x - 7), y0 = Math.round(p.y - 9) + br;
		this.poly([{ x: p.x - 9, y: p.y }, { x: p.x + 9, y: p.y }, { x: p.x + 6, y: p.y + 2 }, { x: p.x - 6, y: p.y + 2 }], 'rgba(60,30,15,.25)');
		CAT.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) { const col = pal[row[rx]]; if (col) this.px(x0 + rx, y0 + ry, 1, 1, col); } });
		if (awake && Math.floor(this.t * 3) % 2) this.px(x0 + 13, y0 + 5, 2, 1, '#f0a050');
	}

	/* ─────────── персонажі ─────────── */
	private sprite(k: SpriteId) {
		const c = this.pos[k];
		const p = s(c.gx, c.gy);
		const moving = Math.abs(c.tx - c.gx) > 0.01 || Math.abs(c.ty - c.gy) > 0.01;
		const role = k === 'client' ? null : (k as Role);
		const status = role ? this.input.agents[role].status : 'idle';
		const burn = role ? this.input.agents[role].burnout : 0;
		const bob = moving ? 0 : Math.round(Math.sin(this.t * (burn > 70 ? 1.6 : 3.3) + k.length) * 0.6);
		// Сидить: за столом — спиною до нас (ноги ховає спинка крісла), у кріслі біля вікна — обличчям, з ноутом.
		const near = (q: { gx: number; gy: number }) => Math.hypot(c.gx - q.gx, c.gy - q.gy) < 0.05;
		const atDesk = !!role && !moving && near(SPOTS[role].desk);
		const inArm = !!role && !moving && near(ARMCHAIR);
		const sit = atDesk ? 3 : inArm ? 6 : 0;
		const x = Math.round(p.x - SPRITE_W / 2), y = Math.round(p.y - SPRITE_H) + bob + sit;
		if (!sit) this.poly([{ x: p.x, y: p.y - 3 }, { x: p.x + 8, y: p.y }, { x: p.x, y: p.y + 3 }, { x: p.x - 8, y: p.y }], 'rgba(60,30,15,.28)');
		const cs = k === 'client' ? clientSprite(this.input.client.gender, this.input.client.look) : null;
		const pal: Record<string, string> = cs ? cs.pal : PALETTE[k];
		const legs = (cs ? cs.legs : LEGS[k])[moving ? Math.floor(this.t * 6) % 2 : 0];
		const rows = atDesk ? BACK[role!].slice(0, 21) : inArm ? BODY[k].slice(0, 21) : (cs ? cs.body : BODY[k]).concat(legs);
		const blink = Math.sin(this.t * 1.1 + k.length * 2.1) > 0.985;
		const filled = (rx: number, ry: number) => ry >= 0 && ry < rows.length && rx >= 0 && rx < SPRITE_W && rows[ry][rx] !== '.';
		// обводка: темний колір навколо силуету
		this.o.fillStyle = pal.outline;
		for (let ry = -1; ry <= rows.length; ry++) for (let rx = -1; rx <= SPRITE_W; rx++) {
			if (filled(rx, ry)) continue;
			if (filled(rx - 1, ry) || filled(rx + 1, ry) || filled(rx, ry - 1) || filled(rx, ry + 1)) this.o.fillRect(x + rx, y + ry, 1, 1);
		}
		rows.forEach((row, ry) => {
			for (let rx = 0; rx < row.length; rx++) {
				let ch = row[rx];
				if (ch === '.') continue;
				if (blink && ry >= 6 && ry <= 9 && (ch === 'E' || ch === 'W')) ch = 'S';
				const col = pal[ch];
				if (!col) continue;
				this.o.fillStyle = col;
				this.o.fillRect(x + rx, y + ry, 1, 1);
			}
		});
		if (inArm) {
			// ноутбук на колінах: кришкою до нас
			this.px(x + 3, y + 15, 10, 6, '#c9ced6');
			this.px(x + 3, y + 15, 10, 1, '#eef1f5');
			this.px(x + 7, y + 17, 2, 2, '#f6f8fb');
			this.px(x + 2, y + 21, 12, 1, '#8f96a0');
		}
		let emote: keyof typeof EMOTE | null = null;
		if (role && this.input.gptFor === role) emote = 'gpt';
		else if (status === 'thinking') emote = 'think';
		else if (burn >= 80) emote = 'tired';
		else if (k === 'client' && this.input.speaking.includes('client')) emote = 'angry';
		if (emote) this.emote(EMOTE[emote], p.x, y - 11, emote === 'gpt' ? C.gptDk : emote === 'tired' ? '#5a6a88' : emote === 'angry' ? '#d8433a' : '#3a2a20');
		if (burn >= 65) {
			const cy = y - 3 + Math.round(Math.sin(this.t * 1.5) * 0.8);
			this.px(p.x + 6, cy, 6, 2, 'rgba(110,115,140,.8)');
			this.px(p.x + 7, cy - 1, 4, 1, 'rgba(110,115,140,.8)');
			if (Math.floor(this.t * 2) % 2) this.px(p.x + 8, cy + 3, 1, 2, 'rgba(140,180,230,.9)');
		}
	}

	private emote(map: string[], cx: number, top: number, col: string) {
		const x0 = Math.round(cx - 4.5), y0 = Math.round(top - 1);
		this.px(x0 - 1, y0 - 1, 11, 11, '#3a2a20');
		this.px(x0, y0, 9, 9, '#fffdf2');
		this.px(x0 + 3, y0 + 9, 3, 1, '#fffdf2');
		this.px(x0 + 4, y0 + 10, 1, 1, '#3a2a20');
		map.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'x') this.px(x0 + 1 + rx, y0 + 1 + ry, 1, 1, col); });
	}

	private gptPoint(r: Role): P {
		const d = DESKS[r];
		return at(d.gx + 0.7, d.gy + 0.4, DESK_H + 30 + Math.round(Math.sin(this.t * 2) * 1.5));
	}

	private gptHologram(r: Role) {
		const p = this.gptPoint(r);
		this.o.globalAlpha = 0.85 + Math.sin(this.t * 8) * 0.08;
		this.px(p.x - 7, p.y - 6, 14, 11, C.gptDk);
		this.px(p.x - 6, p.y - 5, 12, 9, C.gpt);
		this.px(p.x - 4, p.y - 3, 2, 2, C.gptDk); this.px(p.x + 2, p.y - 3, 2, 2, C.gptDk);
		this.px(p.x - 3, p.y + 1, 6, 1, C.gptDk);
		this.o.globalAlpha = 0.28;
		this.poly([{ x: p.x - 5, y: p.y + 5 }, { x: p.x + 5, y: p.y + 5 }, { x: p.x + 2, y: p.y + 17 }, { x: p.x - 2, y: p.y + 17 }], C.gpt);
		this.o.globalAlpha = 1;
	}

	/** Підписи — уже в екранних пікселях, чітким шрифтом. */
	private labels() {
		const c = this.ctx;
		c.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		const fs = Math.max(10, Math.min(13, 4 * this.S));
		c.font = `${fs}px Tiny5, Onest, system-ui, sans-serif`;
		// Хто вже вийшов у двері на вихідний — без підпису (сам спрайт теж не малюється).
		const gone = (r: Role) => this.input.away && Math.hypot(this.pos[r].gx - SPOTS[r].away.gx, this.pos[r].gy - SPOTS[r].away.gy) < 0.25;
		const items: [string, P][] = ROLES.filter((r) => !gone(r)).map((r) => [ROLE_NAME[r], s(this.pos[r].gx, this.pos[r].gy)]);
		if (this.input.clientInOffice || this.pos.client.gx !== CLIENT_DOOR.gx) items.push(['Клієнт', s(this.pos.client.gx, this.pos.client.gy)]);
		for (const [name, p] of items) {
			const x = this.TX + p.x * this.S, y = this.TY + (p.y + 7) * this.S;
			const w = c.measureText(name).width + 10;
			c.fillStyle = 'rgba(30,20,16,.82)';
			c.beginPath();
			c.roundRect(x - w / 2, y - fs * 0.75, w, fs * 1.5, 3);
			c.fill();
			c.fillStyle = '#fbefd9';
			c.fillText(name, x, y + 0.5);
		}
	}
}
