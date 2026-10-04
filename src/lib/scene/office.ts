import { ROLES, ROLE_NAME, type LogoSpec, type Role, type Speaker, type Spot } from '$lib/types';
import { BODY, EMOTE, LEGS, PALETTE, type SpriteId } from './sprites';

/**
 * Ізометричний офіс. Малюється у фіксованих логічних координатах 358×270 і масштабується цілим
 * кроком — пікселі лишаються чіткими, а на 390px сцена влазить з відступами по 16px.
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

/* ─────────── палітра сцени ─────────── */
const C = {
	wallL: '#ffe9cc', wallLtop: '#fff1de', wallR: '#f7d9ae', wallRtop: '#ffe6c2', skirt: '#c89b6a', skirtDk: '#a87a4e',
	floorA: '#dca96f', floorB: '#ce9860', floorLine: 'rgba(150,104,62,.3)',
	frame: '#8d6748', frameDk: '#6e4e33', curtain: '#f2b8c6', curtainDk: '#de9aac',
	board: '#fbf7f0', ink: '#c3ae9a', red: '#e07a6a',
	wood: '#b4835a', woodTop: '#c79b6e', woodDk: '#8b6039', woodDkr: '#70492a',
	metal: '#8c9aa3', metalDk: '#6b7880', metalTop: '#a4b1b8', screen: '#2e4a3c', screenOn: '#7fcb94', screenOn2: '#a8ddb6',
	rug: '#9eb8b0', rugIn: '#bcd0c8', rugEdge: '#7d9a92',
	plant: '#6dae5f', plantDk: '#4c8842', plantLt: '#8fc97f', pot: '#d98a63', potTop: '#e39c76',
	paper: '#fffdf5', mug: '#ffffff', mugDk: '#e4e4e4', coffee: '#6b4226',
	cat: '#f0a860', catDk: '#d2853f', catLt: '#ffc489', door: '#9a6b47', doorDk: '#7a5232',
	gpt: '#5ee6c8', gptDk: '#1f8f7a',
	book: ['#e07a6a', '#7ba7d4', '#f0c05a', '#8fc97f', '#b98fd0', '#e39c76']
};

/* ─────────── місця ─────────── */
const DESKS: Record<Role, { gx: number; gy: number }> = { strategist: { gx: 0.75, gy: 1.05 }, copywriter: { gx: 3.15, gy: 1.05 }, designer: { gx: 5.55, gy: 1.05 } };
const DESK_W = 1.55, DESK_D = 0.9, DESK_H = 16;
const SPOTS: Record<Role, Record<Spot, { gx: number; gy: number }>> = {
	strategist: { desk: { gx: 1.45, gy: 0.6 }, table: { gx: 1.7, gy: 4.2 }, board: { gx: 2.72, gy: 0.62 }, coffee: { gx: 5.75, gy: 4.25 } },
	copywriter: { desk: { gx: 3.85, gy: 0.6 }, table: { gx: 3.4, gy: 2.95 }, board: { gx: 2.72, gy: 0.62 }, coffee: { gx: 5.85, gy: 5.45 } },
	designer: { desk: { gx: 6.25, gy: 0.6 }, table: { gx: 5.3, gy: 4.95 }, board: { gx: 2.72, gy: 0.62 }, coffee: { gx: 7.5, gy: 5.75 } }
};
const CLIENT_DOOR = { gx: 0.35, gy: 5.15 };
const CLIENT_TABLE = { gx: 3.45, gy: 5.8 };

/* ─────────── полотно ─────────── */
export class Office {
	private ctx: CanvasRenderingContext2D;
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
			const sp = SPOTS[r][input.agents[r].spot];
			// Біля дошки стоїть тільки той, хто туди пішов; інші — на своїх місцях.
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
		// Крок — один піксель пристрою: на екрані з DPR 2 масштаб 2,5 лишається чітким.
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
		return { x: this.TX + p.x * this.S, y: this.TY + (p.y - 42) * this.S };
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
			const step = 2.4 * dt; // тайлів за секунду
			if (d <= step || d < 0.01) { c.gx = c.tx; c.gy = c.ty; } else { c.gx += (dx / d) * step; c.gy += (dy / d) * step; }
		}
		this.draw();
		this.raf = requestAnimationFrame(this.loop);
	};

	/* ─────────── примітиви ─────────── */
	private poly(pts: P[], fill: string) {
		const c = this.ctx;
		c.beginPath();
		c.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
		c.closePath();
		c.fillStyle = fill;
		c.fill();
	}
	private px(x: number, y: number, w: number, h: number, fill: string) { this.ctx.fillStyle = fill; this.ctx.fillRect(x, y, w, h); }
	private qL(d1: number, d2: number, h1: number, h2: number, f: string) { this.poly([wL(d1, h1), wL(d2, h1), wL(d2, h2), wL(d1, h2)], f); }
	private qR(d1: number, d2: number, h1: number, h2: number, f: string) { this.poly([wR(d1, h1), wR(d2, h1), wR(d2, h2), wR(d1, h2)], f); }
	private qH(x1: number, y1: number, x2: number, y2: number, h: number, f: string) { this.poly([at(x1, y1, h), at(x2, y1, h), at(x2, y2, h), at(x1, y2, h)], f); }
	private qFace(g1: number, g2: number, gy: number, h1: number, h2: number, f: string) { this.poly([at(g1, gy, h2), at(g2, gy, h2), at(g2, gy, h1), at(g1, gy, h1)], f); }
	private box(gx: number, gy: number, w: number, d: number, h: number, top: string, right: string, left: string) {
		const A = s(gx, gy), B = s(gx + w, gy), Cc = s(gx + w, gy + d), D = s(gx, gy + d);
		const up = (p: P) => ({ x: p.x, y: p.y - h });
		this.poly([up(B), up(Cc), Cc, B], right);
		this.poly([up(D), up(Cc), Cc, D], left);
		this.poly([up(A), up(B), up(Cc), up(D)], top);
	}

	/* ─────────── кадр ─────────── */
	private draw() {
		const c = this.ctx;
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.clearRect(0, 0, this.canvas.width, this.canvas.height);
		c.imageSmoothingEnabled = false;
		c.setTransform(this.S * this.DPR, 0, 0, this.S * this.DPR, this.TX * this.DPR, this.TY * this.DPR);

		const night = this.night();
		this.shadow();
		this.walls();
		this.floor();
		if (night < 0.6 && (this.input.sky === 'clear' || this.input.sky === 'clouds')) this.sunPatch(1 - night);
		this.windowView();
		this.decor();
		this.objects();
		if (night > 0) this.nightTint(night);
		this.labels();
	}

	/** 0 — день, 1 — глибока ніч; плавно на світанку й у сутінках. */
	private night(): number {
		const h = this.input.hour;
		if (h >= 8 && h < 18) return 0;
		if (h >= 22 || h < 5) return 1;
		if (h >= 18) return (h - 18) / 4;
		return 1 - (h - 5) / 3;
	}

	private shadow() {
		const f = s(GW, GH), l = s(0, GH), r = s(GW, 0);
		this.poly([{ x: l.x - 3, y: l.y + 5 }, { x: f.x, y: f.y + 8 }, { x: r.x + 3, y: r.y + 5 }, { x: f.x, y: f.y + 2 }], 'rgba(0,0,0,.18)');
	}

	private walls() {
		this.qL(0, GH, 0, WH, C.wallL); this.qL(0, GH, WH - 7, WH, C.wallLtop); this.qL(0, GH, 0, 7, C.skirt);
		this.qR(0, GW, 0, WH, C.wallR); this.qR(0, GW, WH - 7, WH, C.wallRtop); this.qR(0, GW, 0, 7, C.skirtDk);
		const a = wL(0, 0), b = wL(0, WH);
		this.poly([a, b, { x: b.x + 1.5, y: b.y }, { x: a.x + 1.5, y: a.y }], 'rgba(150,104,62,.16)');
	}

	private floor() {
		for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
			const p = s(gx + 0.5, gy + 0.5);
			const pts = [{ x: p.x, y: p.y - TH }, { x: p.x + TW, y: p.y }, { x: p.x, y: p.y + TH }, { x: p.x - TW, y: p.y }];
			this.poly(pts, (gx + gy) % 2 ? C.floorB : C.floorA);
			const c = this.ctx;
			c.beginPath(); c.moveTo(pts[0].x, pts[0].y); for (const q of pts.slice(1)) c.lineTo(q.x, q.y); c.closePath();
			c.strokeStyle = C.floorLine; c.lineWidth = 0.7; c.stroke();
		}
	}

	private sunPatch(k: number) {
		const a = (this.input.sky === 'clouds' ? 0.14 : 0.3) * k;
		this.poly([s(0, 1.1), s(4.4, 1.9), s(4.4, 4.2), s(0, 3.5)], `rgba(255,214,130,${a})`);
	}

	/** Небо у вікні: година доби і погода. */
	private windowView() {
		const d1 = 1.15, d2 = 3.45, h1 = 24, h2 = 66;
		const c = this.ctx;
		this.qL(d1 - 0.18, d2 + 0.18, h1 - 4, h2 + 4, C.frame);
		c.save();
		c.beginPath();
		const w = [wL(d1, h1), wL(d2, h1), wL(d2, h2), wL(d1, h2)];
		c.moveTo(w[0].x, w[0].y); for (const p of w.slice(1)) c.lineTo(p.x, p.y); c.closePath(); c.clip();

		const [top, bottom] = this.skyColors();
		this.qL(d1, d2, h1, h2, top);
		this.qL(d1, d2, h1, h1 + 16, bottom);
		const sky = this.input.sky, n = this.night(), t = this.t;

		if (n > 0.5 && (sky === 'clear' || sky === 'clouds')) {
			for (let i = 0; i < 14; i++) {
				const dd = d1 + ((i * 0.37) % 1) * (d2 - d1), hh = h1 + 18 + ((i * 7.3) % 24);
				const p = wL(dd, hh);
				if ((Math.sin(t * 2 + i) + 1) / 2 > 0.25) this.px(p.x, p.y, 1, 1, '#fff6d0');
			}
			const m = wL(d2 - 0.55, h2 - 10);
			this.px(m.x - 3, m.y - 3, 6, 6, '#f4ecc8'); this.px(m.x - 1, m.y - 3, 4, 4, top);
		} else if (n < 0.5 && sky === 'clear') {
			const sp = wL(d2 - 0.5, h2 - 11);
			this.px(sp.x - 3, sp.y - 3, 6, 6, '#ffe39a');
		}

		const clouds = sky === 'clear' ? 2 : sky === 'fog' ? 0 : 5;
		const cc = n > 0.5 ? 'rgba(170,180,210,.55)' : sky === 'storm' || sky === 'rain' ? 'rgba(200,205,215,.9)' : 'rgba(255,255,255,.85)';
		for (let i = 0; i < clouds; i++) {
			const dd = d1 + ((t * 0.04 * (1 + i * 0.25) + i * 0.31) % 1) * (d2 - d1);
			const hh = h1 + 22 + ((i * 9) % 20);
			this.qL(dd, dd + 0.55, hh, hh + 5, cc);
			this.qL(dd + 0.2, dd + 0.8, hh + 3, hh + 8, cc);
		}
		if (sky === 'rain' || sky === 'storm') {
			for (let i = 0; i < 26; i++) {
				const dd = d1 + ((i * 0.173) % 1) * (d2 - d1);
				const hh = h2 - (((t * 60 + i * 13) % (h2 - h1)));
				const p = wL(dd, hh);
				this.px(p.x, p.y, 0.8, 3, 'rgba(190,215,240,.85)');
			}
			if (sky === 'storm' && Math.sin(t * 0.9) > 0.985) this.qL(d1, d2, h1, h2, 'rgba(255,255,255,.6)');
		}
		if (sky === 'snow') {
			for (let i = 0; i < 22; i++) {
				const dd = d1 + ((i * 0.211 + Math.sin(t + i) * 0.02) % 1) * (d2 - d1);
				const hh = h2 - (((t * 10 + i * 11) % (h2 - h1)));
				const p = wL(dd, hh);
				this.px(p.x, p.y, 1.2, 1.2, '#ffffff');
			}
		}
		if (sky === 'fog') this.qL(d1, d2, h1, h2, 'rgba(230,230,235,.55)');
		c.restore();

		this.qL(d1, d2, 44.4, 45.6, C.frame);
		this.qL(2.24, 2.36, h1, h2, C.frame);
		this.qL(d1, d2, h1, h2, 'rgba(255,255,255,.12)');
		this.qL(d1 - 0.3, d2 + 0.3, h1 - 6, h1 - 3, C.frameDk);
		this.qL(d1 - 0.34, d1 + 0.12, h1 - 2, h2 + 8, C.curtain);
		this.qL(d2 - 0.12, d2 + 0.34, h1 - 2, h2 + 8, C.curtain);
		this.qL(d1 - 0.34, d1 - 0.1, h1 - 2, h2 + 8, C.curtainDk);
		this.qL(d2 + 0.1, d2 + 0.34, h1 - 2, h2 + 8, C.curtainDk);
		this.qL(d1 - 0.5, d2 + 0.5, h2 + 8, h2 + 10.5, C.frameDk);
	}

	private skyColors(): [string, string] {
		const h = this.input.hour, sky = this.input.sky;
		const grey = sky === 'rain' || sky === 'storm' || sky === 'fog';
		if (h >= 22 || h < 5) return ['#1b2340', '#25305a'];
		if (h < 8) return grey ? ['#8a8fa8', '#b0a8b8'] : ['#f2b48a', '#f8d6a8'];
		if (h < 18) return grey ? ['#9aa6b4', '#b8c2cc'] : ['#aedcf0', '#cdebf8'];
		return grey ? ['#6f7088', '#8f8aa0'] : ['#c98ab8', '#f2b48a'];
	}

	private nightTint(k: number) {
		const f = s(GW, GH), l = s(0, GH), r = s(GW, 0), top = { x: OX, y: OY - WH };
		this.poly([{ x: l.x, y: l.y - WH }, top, { x: r.x, y: r.y - WH }, r, f, l], `rgba(24,28,60,${0.38 * k})`);
		// Настільні лампи гріють простір навколо столів.
		for (const r of ROLES) {
			const d = DESKS[r];
			const p = s(d.gx + 1.2, d.gy + 0.45);
			const g = this.ctx.createRadialGradient(p.x, p.y - 10, 2, p.x, p.y - 10, 46);
			g.addColorStop(0, `rgba(255,200,120,${0.32 * k})`);
			g.addColorStop(1, 'rgba(255,200,120,0)');
			this.ctx.fillStyle = g;
			this.ctx.fillRect(p.x - 50, p.y - 60, 100, 100);
		}
	}

	private decor() {
		// двері на лівій стіні — звідси заходить клієнт
		this.qL(4.55, 5.7, 0, 50, C.doorDk);
		this.qL(4.65, 5.6, 0, 47, C.door);
		this.qL(5.38, 5.48, 22, 25, '#e8c27a');
		// дошка: 4 слоти пакета
		const b1 = 0.9, b2 = 4.0, bh1 = 30, bh2 = 68;
		this.qR(b1 - 0.16, b2 + 0.16, bh1 - 3, bh2 + 3, C.frame);
		this.qR(b1, b2, bh1, bh2, C.board);
		const slots: [keyof SceneInput['board'], number, number, number, number, string][] = [
			['positioning', b1 + 0.15, b1 + 1.45, bh2 - 18, bh2 - 4, '#e07a6a'],
			['name', b1 + 1.65, b2 - 0.15, bh2 - 18, bh2 - 4, '#7ba7d4'],
			['slogan', b1 + 0.15, b1 + 1.45, bh1 + 4, bh1 + 16, '#f0c05a'],
			['logo', b1 + 1.65, b2 - 0.15, bh1 + 4, bh1 + 16, '#8fc97f']
		];
		for (const [k, d1, d2, h1, h2, col] of slots) {
			if (this.input.board[k]) {
				this.qR(d1, d2, h1, h2, col);
				if (k === 'logo' && this.input.logo) {
					const pa = this.input.logo.palette;
					this.qR(d1 + 0.35, d2 - 0.35, h1 + 2, h2 - 2, pa.a);
					this.qR(d1 + 0.55, d2 - 0.55, h1 + 4, h2 - 4, pa.b);
				} else for (let i = 0; i < 2; i++) this.qR(d1 + 0.12, d2 - 0.3 - i * 0.3, h2 - 4 - i * 4, h2 - 2.6 - i * 4, 'rgba(255,255,255,.75)');
			} else {
				this.qR(d1, d2, h1, h1 + 0.8, C.ink); this.qR(d1, d2, h2 - 0.8, h2, C.ink);
				this.qR(d1, d1 + 0.04, h1, h2, C.ink); this.qR(d2 - 0.04, d2, h1, h2, C.ink);
			}
		}
		// полиці
		this.shelf(5.0, 7.4, 52, [0, 1, 2, 3, 4]);
		this.shelf(5.4, 7.4, 30, [3, 5, 1]);
		// годинник показує справжню годину
		const c1 = 4.45, c2 = 4.95, ch = 62;
		this.qR(c1 - 0.06, c2 + 0.06, ch - 0.06, ch + 11, C.frameDk);
		this.qR(c1, c2, ch, ch + 10.8, C.board);
		const cc = wR((c1 + c2) / 2, ch + 5.4);
		const hr = (this.input.hour % 12) / 12 * Math.PI * 2, mn = ((this.input.hour % 1) * 60) / 60 * Math.PI * 2;
		const c = this.ctx;
		c.strokeStyle = '#4e342e'; c.lineWidth = 0.9;
		c.beginPath(); c.moveTo(cc.x, cc.y); c.lineTo(cc.x + Math.sin(mn) * 4, cc.y - Math.cos(mn) * 4); c.stroke();
		c.beginPath(); c.moveTo(cc.x, cc.y); c.lineTo(cc.x + Math.sin(hr) * 2.6, cc.y - Math.cos(hr) * 2.6); c.stroke();
	}

	private shelf(d1: number, d2: number, h: number, books: number[]) {
		this.qR(d1 - 0.1, d2 + 0.1, h, h + 2.4, C.wood);
		this.qR(d1 - 0.1, d2 + 0.1, h - 1.6, h, C.woodDk);
		books.forEach((b, i) => {
			const d = d1 + 0.16 + i * 0.42;
			if (d + 0.3 > d2) return;
			const bh = 9 + (i % 3) * 2.5;
			this.qR(d, d + 0.3, h + 2.4, h + 2.4 + bh, C.book[b % C.book.length]);
		});
	}

	private objects() {
		this.rug();
		const list: { depth: number; fn: () => void }[] = [];
		const add = (depth: number, fn: () => void) => list.push({ depth, fn });
		add(0.3, () => this.plant(0.35, 0.35, 1.15));
		add(GW - 0.1, () => this.plant(GW - 0.45, 0.35, 0.95));
		for (const r of ROLES) {
			const d = DESKS[r];
			// стілець — за власним тайлом, а не за позицією агента
			add(d.gx + 0.44 + 0.18 + 0.5, () => this.chair(d.gx + 0.44, 0.18));
			add(d.gx + DESK_W + d.gy + DESK_D, () => this.desk(r, d.gx, d.gy));
		}
		for (const k of ['strategist', 'copywriter', 'designer', 'client'] as SpriteId[]) {
			if (k === 'client' && !this.input.clientInOffice && this.pos.client.gx === CLIENT_DOOR.gx) continue;
			const c = this.pos[k];
			add(c.gx + c.gy, () => this.sprite(k));
		}
		add(2.2 + 3.6 + 2.4 + 1.6, () => this.meetingTable(2.2, 3.6));
		add(6.5 + 3.9 + 1.4 + 1.05, () => this.coffeeCorner(6.5, 3.9));
		add(2.9 + 5.05, () => this.cat(2.9, 5.05));
		add(7.4 + 2.6, () => { this.box(7.3, 2.35, 0.62, 0.62, 13, '#d9b98c', '#b4936a', '#a17f58'); });
		list.sort((a, b) => a.depth - b.depth).forEach((o) => o.fn());
		if (this.input.gptFor) this.gptHologram(this.input.gptFor);
	}

	private rug() {
		this.poly([s(1.9, 3.3), s(5.1, 3.3), s(5.1, 5.7), s(1.9, 5.7)], C.rugEdge);
		this.poly([s(2.02, 3.42), s(4.98, 3.42), s(4.98, 5.58), s(2.02, 5.58)], C.rug);
		this.poly([s(2.3, 3.7), s(4.7, 3.7), s(4.7, 5.3), s(2.3, 5.3)], C.rugIn);
	}

	private chair(gx: number, gy: number) {
		this.box(gx, gy, 0.52, 0.46, 9, C.woodDk, C.woodDkr, C.woodDkr);
		this.box(gx, gy - 0.1, 0.52, 0.1, 23, C.woodDk, C.woodDkr, C.woodDkr);
	}

	private desk(r: Role, gx: number, gy: number) {
		const w = DESK_W, d = DESK_D, h = DESK_H;
		for (const [ox, oy] of [[0.06, 0.06], [w - 0.16, 0.06], [0.06, d - 0.16], [w - 0.16, d - 0.16]]) this.box(gx + ox, gy + oy, 0.1, 0.1, h - 1.5, C.woodDk, C.woodDkr, C.woodDkr);
		this.box(gx, gy, w, d, h, C.woodTop, C.wood, C.woodDk);
		const mx = gx + 0.08, my = gy + 0.12, mw = 0.55, md = 0.12, h1 = h + 4, h2 = h + 18;
		this.qH(mx + 0.18, my, mx + 0.38, my + md, h1, C.metalDk);
		this.qFace(mx + 0.18, mx + 0.38, my + md, h, h1, C.metalDk);
		this.qH(mx, my, mx + mw, my + md, h2, C.metalTop);
		this.poly([at(mx + mw, my, h2), at(mx + mw, my + md, h2), at(mx + mw, my + md, h1), at(mx + mw, my, h1)], C.metal);
		this.qFace(mx, mx + mw, my + md, h1, h2, C.metalDk);
		const asking = this.input.gptFor === r;
		this.qFace(mx + 0.05, mx + mw - 0.05, my + md, h1 + 1.6, h2 - 1.6, asking ? C.gptDk : C.screen);
		const busy = this.input.agents[r].status === 'thinking' || asking;
		for (let i = 0; i < 4; i++) {
			const yy = h1 + 3 + i * 3.1;
			const ww = (mw - 0.16) * (busy ? 0.4 + ((Math.sin(this.t * 6 + i * 1.7 + gx) + 1) / 2) * 0.6 : i % 2 ? 0.62 : 1);
			this.qFace(mx + 0.09, mx + 0.09 + ww, my + md, yy, yy + 1.5, asking ? C.gpt : i === 0 ? C.screenOn2 : C.screenOn);
		}
		this.qH(gx + 0.78, gy + 0.5, gx + 1.14, gy + 0.76, h, C.paper);
		// лампа (вночі світить)
		const lp = at(gx + 1.2, gy + 0.25, h);
		this.px(lp.x - 0.8, lp.y - 9, 1.6, 9, C.metalDk);
		this.px(lp.x - 3, lp.y - 12, 6, 3, '#e8b65a');
		this.mug(gx + 1.3, gy + 0.62, h);
	}

	private mug(gx: number, gy: number, base: number) {
		const p = s(gx, gy), y = p.y - base;
		this.px(p.x - 2.6, y - 6, 5.2, 6, C.mug); this.px(p.x - 2.6, y - 6, 5.2, 1.6, C.mugDk);
		this.px(p.x - 2, y - 5.2, 4, 1.4, C.coffee); this.px(p.x + 2.6, y - 4.6, 1.6, 2.6, C.mug);
	}

	private meetingTable(gx: number, gy: number) {
		const w = 2.4, d = 1.6, h = 15;
		this.box(gx, gy, w, d, h, C.woodTop, C.wood, C.woodDk);
		this.box(gx + w / 2 - 0.16, gy + d / 2 - 0.16, 0.32, 0.32, h - 2, C.woodDk, C.woodDkr, C.woodDkr);
		this.qH(gx + 0.3, gy + 0.3, gx + 0.95, gy + 0.78, h, C.paper);
		this.qH(gx + 1.3, gy + 0.72, gx + 1.95, gy + 1.2, h, '#fff7e4');
		this.mug(gx + 1.9, gy + 0.42, h); this.mug(gx + 0.55, gy + 1.25, h);
	}

	private coffeeCorner(gx: number, gy: number) {
		const CH = 18;
		this.box(gx, gy, 1.4, 1.05, CH, C.woodTop, C.wood, C.woodDk);
		const mx = gx + 0.16, my = gy + 0.18, mw = 0.58, md = 0.46, t1 = CH, t2 = CH + 24;
		this.qH(mx, my, mx + mw, my + md, t2, C.metalTop);
		this.poly([at(mx + mw, my, t2), at(mx + mw, my + md, t2), at(mx + mw, my + md, t1), at(mx + mw, my, t1)], C.metalDk);
		this.qFace(mx, mx + mw, my + md, t1, t2, C.metal);
		this.qFace(mx + 0.08, mx + mw - 0.08, my + md, t2 - 9, t2 - 2, '#3a4a52');
		this.qFace(mx + 0.16, mx + 0.42, my + md, t1 + 1, t1 + 5, '#2e3a40');
		for (let i = 0; i < 4; i++) {
			const ph = (this.t * 0.55 + i * 0.25) % 1;
			const p = at(mx + mw / 2, my + md / 2, t2 + 2 + ph * 20);
			this.ctx.globalAlpha = (1 - ph) * 0.55;
			this.px(p.x + Math.sin(ph * 7 + i * 1.7) * 3 - 1.3, p.y, 2.8, 2.8, '#ffffff');
		}
		this.ctx.globalAlpha = 1;
		this.mug(gx + 1.06, gy + 0.34, CH + 0.5);
		this.plant(gx + 0.26, gy + 1.42, 1.2);
	}

	private plant(gx: number, gy: number, sc = 1) {
		const p = s(gx, gy), pw = 9 * sc, ph = 9 * sc;
		this.px(p.x - pw / 2, p.y - ph, pw, ph, C.pot);
		this.px(p.x - pw / 2 - 1, p.y - ph, pw + 2, 2.6 * sc, C.potTop);
		const leaves: [number, number, string][] = [[-6, -8, C.plantDk], [-2, -13, C.plant], [3, -11, C.plantLt], [6, -7, C.plantDk], [0, -17, C.plant], [-5, -12, C.plantLt], [4, -15, C.plantDk]];
		for (const [lx, ly, col] of leaves) this.px(p.x + lx * sc - 2 * sc, p.y - ph + ly * sc, 4.4 * sc, 4.4 * sc, col);
	}

	private cat(gx: number, gy: number) {
		const p = s(gx, gy), x = p.x, y = p.y, t = this.t;
		const awake = this.input.clientInOffice;
		const br = Math.sin(t * 2.2) * 0.6;
		this.px(x - 9, y - 7 + br, 18, 7, C.cat); this.px(x - 9, y - 7 + br, 18, 2.4, C.catLt);
		this.px(x - 13, y - 9 + br, 8, 7, C.cat);
		this.px(x - 13, y - 11.5 + br, 2.6, 2.6, C.catDk); this.px(x - 8.6, y - 11.5 + br, 2.6, 2.6, C.catDk);
		if (awake) { this.px(x - 11.6, y - 6.6, 1.4, 1.4, '#3a8a3a'); this.px(x - 7.8, y - 6.6, 1.4, 1.4, '#3a8a3a'); }
		else { this.px(x - 11.6, y - 6 + br, 2, 1, '#4e342e'); this.px(x - 7.8, y - 6 + br, 2, 1, '#4e342e'); }
		const wag = Math.sin(t * (awake ? 6 : 2.8)) * 3;
		this.px(x + 7, y - 5, 6, 2.4, C.catDk); this.px(x + 12, y - 6 + wag, 5, 2.4, C.cat);
	}

	private sprite(k: SpriteId) {
		const c = this.pos[k];
		const p = s(c.gx, c.gy);
		const moving = Math.abs(c.tx - c.gx) > 0.01 || Math.abs(c.ty - c.gy) > 0.01;
		const role = k === 'client' ? null : (k as Role);
		const status = role ? this.input.agents[role].status : 'idle';
		const burn = role ? this.input.agents[role].burnout : 0;
		const bob = moving ? 0 : Math.sin(this.t * (burn > 70 ? 1.6 : 3.3) + k.length) * 1.1;
		const P = 2;
		const x = p.x - 6 * P, y = p.y - 18 * P + bob;
		this.poly([{ x: p.x, y: p.y - 3.4 }, { x: p.x + 10, y: p.y }, { x: p.x, y: p.y + 3.4 }, { x: p.x - 10, y: p.y }], 'rgba(90,60,40,.2)');
		const pal = PALETTE[k];
		const legs = LEGS[k][moving ? Math.floor(this.t * 6) % 2 : 0];
		const rows = BODY[k].concat(legs);
		const blink = Math.sin(this.t * 1.1 + k.length * 2.1) > 0.985;
		const c2 = this.ctx;
		rows.forEach((row, ry) => {
			for (let rx = 0; rx < row.length; rx++) {
				let ch = row[rx];
				if (ch === '.') continue;
				if (blink && (ch === 'E' || ch === 'W') && ry < 8) ch = 'S';
				const col = pal[ch];
				if (!col) continue;
				c2.fillStyle = col;
				c2.fillRect(x + rx * P, y + ry * P, P, P);
			}
		});
		// емоція над головою
		let emote: keyof typeof EMOTE | null = null;
		if (role && this.input.gptFor === role) emote = 'gpt';
		else if (status === 'thinking') emote = 'think';
		else if (burn >= 80) emote = 'tired';
		else if (k === 'client' && this.input.speaking.includes('client')) emote = 'angry';
		if (emote) this.emote(EMOTE[emote], p.x, y - 9, emote === 'gpt' ? C.gpt : emote === 'tired' ? '#7a8aa8' : emote === 'angry' ? '#e0546a' : '#4e342e');
		// хмарка втоми
		if (burn >= 65) {
			const cy = y - 4 + Math.sin(this.t * 1.5) * 0.8;
			this.px(p.x + 6, cy, 6, 2.5, 'rgba(110,115,140,.75)');
			this.px(p.x + 7, cy - 1.5, 4, 1.5, 'rgba(110,115,140,.75)');
			if (Math.floor(this.t * 2) % 2) this.px(p.x + 8, cy + 3, 0.8, 1.6, 'rgba(140,180,230,.9)');
		}
	}

	private emote(map: string[], cx: number, top: number, col: string) {
		this.px(cx - 4.5, top - 1, 9, 9, 'rgba(255,253,246,.92)');
		map.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === 'x') this.px(cx - 3.5 + rx, top + ry, 1, 1, col); });
	}

	private gptPoint(r: Role): P {
		const d = DESKS[r];
		return at(d.gx + 0.35, d.gy + 0.2, DESK_H + 34 + Math.sin(this.t * 2) * 1.5);
	}

	/** Джіпітенко — голограма-екранчик над монітором того, хто питає. */
	private gptHologram(r: Role) {
		const p = this.gptPoint(r);
		const c = this.ctx;
		c.globalAlpha = 0.85 + Math.sin(this.t * 8) * 0.08;
		this.px(p.x - 7, p.y - 6, 14, 11, C.gptDk);
		this.px(p.x - 6, p.y - 5, 12, 9, C.gpt);
		this.px(p.x - 3.5, p.y - 2.5, 2, 2, C.gptDk); this.px(p.x + 1.5, p.y - 2.5, 2, 2, C.gptDk);
		this.px(p.x - 3, p.y + 1.5, 6, 1, C.gptDk);
		c.globalAlpha = 0.25;
		this.poly([{ x: p.x - 5, y: p.y + 5 }, { x: p.x + 5, y: p.y + 5 }, { x: p.x + 2, y: p.y + 16 }, { x: p.x - 2, y: p.y + 16 }], C.gpt);
		c.globalAlpha = 1;
	}

	private labels() {
		const c = this.ctx;
		c.textAlign = 'center';
		const fs = Math.max(3.4, Math.min(7, 10 / this.S));
		c.font = `500 ${fs}px Onest, system-ui, sans-serif`;
		const items: [string, P][] = ROLES.map((r) => [ROLE_NAME[r], s(this.pos[r].gx, this.pos[r].gy)]);
		if (this.input.clientInOffice || this.pos.client.gx !== CLIENT_DOOR.gx) items.push(['Клієнт', s(this.pos.client.gx, this.pos.client.gy)]);
		for (const [name, p] of items) {
			const y = p.y + fs + 5;
			const w = c.measureText(name).width;
			this.px(p.x - w / 2 - fs * 0.5, y - fs - 1.5, w + fs, fs + 4, 'rgba(22,23,26,.78)');
			c.fillStyle = '#f2ece4';
			c.fillText(name, p.x, y);
		}
	}
}
