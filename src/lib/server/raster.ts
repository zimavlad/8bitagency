import { normalizeLogo } from '$lib/logo';
import type { LogoSpec } from '$lib/types';
import { encodePng } from './png';

/** Растр знака в PNG — щоб передати Gemini справжнє лого, а не опис. */
type Pt = [number, number];

/** Контур path → ламані (криві апроксимуються точками). Лише M L H V C S Q T Z, як дозволяє normalizeLogo. */
export function pathToPolys(d: string): Pt[][] {
	const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
	const polys: Pt[][] = [];
	let cur: Pt[] = [];
	let x = 0, y = 0, sx = 0, sy = 0, cmd = '', lcx = 0, lcy = 0;
	let i = 0;
	const n = () => Number(tok[i++]);
	const cubic = (x1: number, y1: number, x2: number, y2: number, ex: number, ey: number) => {
		for (let k = 1; k <= 10; k++) {
			const t = k / 10, u = 1 - t;
			cur.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey]);
		}
		lcx = x2; lcy = y2; x = ex; y = ey;
	};
	const quad = (x1: number, y1: number, ex: number, ey: number) => {
		for (let k = 1; k <= 10; k++) {
			const t = k / 10, u = 1 - t;
			cur.push([u * u * x + 2 * u * t * x1 + t * t * ex, u * u * y + 2 * u * t * y1 + t * t * ey]);
		}
		lcx = x1; lcy = y1; x = ex; y = ey;
	};
	while (i < tok.length) {
		if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
		const rel = cmd === cmd.toLowerCase();
		const C = cmd.toUpperCase();
		const ox = rel ? x : 0, oy = rel ? y : 0;
		if (C === 'Z') { if (cur.length) polys.push(cur); cur = []; x = sx; y = sy; continue; }
		if (i >= tok.length) break;
		if (C === 'M') { if (cur.length) polys.push(cur); x = ox + n(); y = oy + n(); sx = x; sy = y; cur = [[x, y]]; cmd = rel ? 'l' : 'L'; }
		else if (C === 'L') { x = ox + n(); y = oy + n(); cur.push([x, y]); }
		else if (C === 'H') { x = ox + n(); cur.push([x, y]); }
		else if (C === 'V') { y = oy + n(); cur.push([x, y]); }
		else if (C === 'C') { const a = [n(), n(), n(), n(), n(), n()]; cubic(ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5]); }
		else if (C === 'S') { const a = [n(), n(), n(), n()]; cubic(2 * x - lcx, 2 * y - lcy, ox + a[0], oy + a[1], ox + a[2], oy + a[3]); }
		else if (C === 'Q') { const a = [n(), n(), n(), n()]; quad(ox + a[0], oy + a[1], ox + a[2], oy + a[3]); }
		else if (C === 'T') { const a = [n(), n()]; quad(2 * x - lcx, 2 * y - lcy, ox + a[0], oy + a[1]); }
		else i++;
	}
	if (cur.length) polys.push(cur);
	return polys.filter((p) => p.length >= 3);
}

function inPolys(px: number, py: number, polys: Pt[][]): boolean {
	let inside = false;
	for (const p of polys)
		for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
			const [xi, yi] = p[i], [xj, yj] = p[j];
			if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
		}
	return inside;
}

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function rasterLogo(raw: LogoSpec, size = 256): Buffer | null {
	const spec = normalizeLogo(raw);
	if (!spec) return null;
	const px = new Uint8Array(size * size * 4);
	const k = 100 / size;
	const shapes = spec.shapes.map((s) => ({ s, polys: s.type === 'path' ? pathToPolys(s.d) : s.type === 'polygon' ? [s.points.reduce<Pt[]>((a, v, i) => (i % 2 ? (a[a.length - 1][1] = v, a) : (a.push([v, 0]), a)), [])] : [] }));
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) {
			const X = (x + 0.5) * k, Y = (y + 0.5) * k;
			let col: [number, number, number] | null = null;
			for (const { s, polys } of shapes) {
				let hit = false;
				if (s.type === 'rect') hit = X >= s.x && X <= s.x + s.w && Y >= s.y && Y <= s.y + s.h;
				else if (s.type === 'circle') hit = (X - s.cx) ** 2 + (Y - s.cy) ** 2 <= s.r ** 2;
				else if (s.type === 'ellipse') hit = s.rx > 0 && s.ry > 0 && ((X - s.cx) / s.rx) ** 2 + ((Y - s.cy) / s.ry) ** 2 <= 1;
				else hit = inPolys(X, Y, polys);
				if (hit) col = hex(s.fill === 'b' ? spec.palette.b : spec.palette.a);
			}
			const o = (y * size + x) * 4;
			if (col) { px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = 255; }
		}
	return encodePng(size, size, px);
}
