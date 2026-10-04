import { appendFileSync, mkdirSync, readdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Журнал сервера: рядок JSON на подію — у stdout (Runtime Logs у Coolify) і у файл
 * <DATA_DIR>/logs/app-YYYY-MM-DD.log, 14 днів. Повні тексти прогонів — окремо, в архіві
 * <DATA_DIR>/runs/<id>.json (гра тестова: Влад хоче бачити, що думали агенти).
 */
export type Level = 'info' | 'warn' | 'error';
const KEEP_DAYS = 14;
const dir = () => join(process.env.DATA_DIR ?? './data', 'logs');
let pruned = false;

export function log(level: Level, ev: string, fields: Record<string, unknown> = {}) {
	const line = JSON.stringify({ t: new Date().toISOString(), level, ev, ...fields });
	console.log(line);
	try {
		mkdirSync(dir(), { recursive: true });
		appendFileSync(join(dir(), `app-${line.slice(6, 16)}.log`), line + '\n');
		if (!pruned) prune();
	} catch {
		// журнал не має валити гру
	}
}

function prune() {
	pruned = true;
	const edge = Date.now() - KEEP_DAYS * 86400_000;
	for (const f of readdirSync(dir())) {
		const m = f.match(/^app-(\d{4}-\d{2}-\d{2})\.log$/);
		if (m && Date.parse(m[1]) < edge) unlinkSync(join(dir(), f));
	}
}

export function errFields(e: unknown): Record<string, unknown> {
	const x = e as { name?: string; message?: string; status?: number };
	return { err: x?.name ?? 'Error', msg: String(x?.message ?? e).slice(0, 300), status: x?.status };
}

/** Останні рядки журналу за N днів, з фільтром рівня. */
export function readLogs(days = 1, lines = 500, level?: Level): unknown[] {
	const order: Level[] = ['info', 'warn', 'error'];
	const min = level ? order.indexOf(level) : 0;
	const out: unknown[] = [];
	let files: string[] = [];
	try {
		files = readdirSync(dir()).filter((f) => f.startsWith('app-')).sort().slice(-days);
	} catch {
		return [];
	}
	for (const f of files)
		for (const l of readFileSync(join(dir(), f), 'utf8').split('\n')) {
			if (!l) continue;
			try {
				const j = JSON.parse(l) as { level: Level };
				if (order.indexOf(j.level) >= min) out.push(j);
			} catch {
				// битий рядок пропускаємо
			}
		}
	return out.slice(-lines);
}
