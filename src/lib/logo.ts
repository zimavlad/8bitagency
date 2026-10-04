import type { LogoShape, LogoSpec } from './types';

/**
 * Знак Дизайнера. Модель описує фігури числами, а розмітку SVG збирає тільки цей код:
 * у неї потрапляють лише числа, обрізані до 0..100, кольори за регуляркою і path без літер,
 * крім команд контуру. Тому XSS через атрибути неможливий за побудовою.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const PATH = /^[MLHVCSQTAZmlhvcsqtaz0-9 .,-]+$/;
const MAX_SHAPES = 8;

const num = (v: unknown, lo = 0, hi = 100): number => {
	const n = typeof v === 'number' ? v : Number(v);
	if (!Number.isFinite(n)) return lo;
	return Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10;
};

const fill = (v: unknown): 'a' | 'b' => (v === 'b' ? 'b' : 'a');

/** Приводить відповідь моделі до безпечної специфікації. Порожній результат — null. */
export function normalizeLogo(raw: unknown): LogoSpec | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as { palette?: { a?: unknown; b?: unknown }; shapes?: unknown };
	const a = typeof r.palette?.a === 'string' && HEX.test(r.palette.a) ? r.palette.a : '#d98a63';
	const b = typeof r.palette?.b === 'string' && HEX.test(r.palette.b) ? r.palette.b : '#2b2420';
	const shapes: LogoShape[] = [];
	for (const s of Array.isArray(r.shapes) ? r.shapes.slice(0, MAX_SHAPES) : []) {
		if (!s || typeof s !== 'object') continue;
		const o = s as Record<string, unknown>;
		switch (o.type) {
			case 'rect':
				shapes.push({ type: 'rect', x: num(o.x), y: num(o.y), w: num(o.w), h: num(o.h), r: num(o.r, 0, 50), fill: fill(o.fill) });
				break;
			case 'circle':
				shapes.push({ type: 'circle', cx: num(o.cx), cy: num(o.cy), r: num(o.r, 0, 50), fill: fill(o.fill) });
				break;
			case 'ellipse':
				shapes.push({ type: 'ellipse', cx: num(o.cx), cy: num(o.cy), rx: num(o.rx, 0, 50), ry: num(o.ry, 0, 50), fill: fill(o.fill) });
				break;
			case 'polygon': {
				const pts = Array.isArray(o.points) ? o.points.slice(0, 24).map((p) => num(p)) : [];
				if (pts.length >= 6 && pts.length % 2 === 0) shapes.push({ type: 'polygon', points: pts, fill: fill(o.fill) });
				break;
			}
			case 'path':
				if (typeof o.d === 'string' && o.d.length <= 600 && PATH.test(o.d)) shapes.push({ type: 'path', d: o.d.trim(), fill: fill(o.fill) });
				break;
		}
	}
	return shapes.length ? { palette: { a, b }, shapes } : null;
}

function shapeSvg(s: LogoShape, color: string): string {
	switch (s.type) {
		case 'rect':
			return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r ?? 0}" fill="${color}"/>`;
		case 'circle':
			return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${color}"/>`;
		case 'ellipse':
			return `<ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${color}"/>`;
		case 'polygon':
			return `<polygon points="${s.points.join(' ')}" fill="${color}"/>`;
		case 'path':
			return `<path d="${s.d}" fill="${color}"/>`;
	}
}

/** SVG-рядок. Специфікацію нормалізує ще раз, тож сюди можна передати що завгодно. */
export function buildSvg(raw: LogoSpec | unknown): string {
	const spec = normalizeLogo(raw);
	if (!spec) return '';
	const body = spec.shapes.map((s) => shapeSvg(s, s.fill === 'b' ? spec.palette.b : spec.palette.a)).join('');
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Знак">${body}</svg>`;
}
