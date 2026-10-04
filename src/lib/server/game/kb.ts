import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { Role } from '$lib/types';
import { log } from '../log';

/**
 * База знань Джіпітенка. Файли лежать у <DATA_DIR>/knowledge/<роль>/ — PDF, MD, TXT.
 * Шматки шукаються за спільними коренями слів (BM25 без зовнішніх сервісів).
 * База перечитується, коли змінюється список файлів або їхній розмір.
 */

export interface Chunk {
	source: string;
	text: string;
	terms: Map<string, number>;
	len: number;
}

interface Index {
	signature: string;
	chunks: Chunk[];
	df: Map<string, number>;
	avgLen: number;
}

const CHUNK = 900;
const OVERLAP = 150;
const cache = new Map<string, Index>();

/** Корінь слова: нижній регістр, без апострофів, перші 6 літер. Грубо, але для пошуку порад досить. */
export function terms(text: string): string[] {
	return (text.toLowerCase().replace(/[ʼ’'`]/g, '').match(/[a-zа-яіїєґ0-9]{4,}/giu) ?? []).map((w) => w.slice(0, 6));
}

export function chunkText(text: string, source: string): Chunk[] {
	const clean = text.replace(/\s+/g, ' ').trim();
	const out: Chunk[] = [];
	for (let i = 0; i < clean.length; i += CHUNK - OVERLAP) {
		const piece = clean.slice(i, i + CHUNK);
		if (piece.length < 80) continue;
		const t = terms(piece);
		const m = new Map<string, number>();
		for (const w of t) m.set(w, (m.get(w) ?? 0) + 1);
		out.push({ source, text: piece, terms: m, len: t.length });
	}
	return out;
}

export function buildIndex(chunks: Chunk[], signature = ''): Index {
	const df = new Map<string, number>();
	for (const c of chunks) for (const w of c.terms.keys()) df.set(w, (df.get(w) ?? 0) + 1);
	const avgLen = chunks.length ? chunks.reduce((s, c) => s + c.len, 0) / chunks.length : 1;
	return { signature, chunks, df, avgLen };
}

export function search(index: Index, query: string, k = 3): Chunk[] {
	const q = [...new Set(terms(query))];
	const N = index.chunks.length;
	if (!N || !q.length) return [];
	const scored = index.chunks.map((c) => {
		let s = 0;
		for (const w of q) {
			const f = c.terms.get(w);
			if (!f) continue;
			const n = index.df.get(w) ?? 0;
			const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
			s += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (c.len / index.avgLen)));
		}
		return { c, s };
	});
	return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.c);
}

async function readAny(path: string): Promise<string> {
	const ext = extname(path).toLowerCase();
	if (ext === '.pdf') {
		const { extractText } = await import('unpdf');
		const buf = await readFile(path);
		const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
		return Array.isArray(text) ? text.join('\n') : text;
	}
	if (ext === '.md' || ext === '.txt') return readFile(path, 'utf8');
	return '';
}

export async function indexFor(dataDir: string, role: Role): Promise<Index> {
	const dir = join(dataDir, 'knowledge', role);
	let files: string[] = [];
	try {
		files = (await readdir(dir)).filter((f) => /\.(pdf|md|txt)$/i.test(f)).sort();
	} catch {
		// теки нема — база порожня
	}
	const sizes = await Promise.all(files.map(async (f) => (await stat(join(dir, f))).size));
	const signature = files.map((f, i) => `${f}:${sizes[i]}`).join('|');
	const hit = cache.get(dir);
	if (hit && hit.signature === signature) return hit;

	const chunks: Chunk[] = [];
	for (const f of files) {
		try {
			chunks.push(...chunkText(await readAny(join(dir, f)), f));
		} catch {
			log('warn', 'kb_file_failed', { role, file: f });
		}
	}
	const index = buildIndex(chunks, signature);
	cache.set(dir, index);
	log('info', 'kb_loaded', { role, files: files.length, chunks: chunks.length });
	return index;
}

export async function kbStats(dataDir: string): Promise<Record<Role, number>> {
	const roles: Role[] = ['strategist', 'copywriter', 'designer'];
	const out = {} as Record<Role, number>;
	for (const r of roles) out[r] = new Set((await indexFor(dataDir, r)).chunks.map((c) => c.source)).size;
	return out;
}
