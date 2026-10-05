import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ledger } from '$lib/types';

/**
 * Рахунки API — один на весь сервер: усі гравці витрачають ті самі гроші Claude і Gemini.
 * Влад вводить залишок з консолі, гра віднімає власні витрати від цієї дати. Файл: <DATA_DIR>/ledger.json.
 */
const START = (): Ledger => ({
	claude: { usd: 0.56, at: '2026-10-05', spent: 0 },
	gemini: { usd: 2.85, at: '2026-10-05', spent: 0 }
});

let cache: Ledger | null = null;
let dir = './data';

const file = () => join(dir, 'ledger.json');

export function ledger(dataDir = dir): Ledger {
	dir = dataDir;
	if (cache) return cache;
	try {
		cache = { ...START(), ...(JSON.parse(readFileSync(file(), 'utf8')) as Ledger) };
	} catch {
		cache = START();
		save();
	}
	return cache;
}

function save() {
	if (!cache) return;
	mkdirSync(dir, { recursive: true });
	const tmp = `${file()}.tmp`;
	writeFileSync(tmp, JSON.stringify(cache, null, 1));
	renameSync(tmp, file());
}

export function spendLedger(provider: 'claude' | 'gemini', usd: number) {
	if (!usd) return;
	ledger()[provider].spent += usd;
	save();
}

export function setLedger(provider: 'claude' | 'gemini', usd: number) {
	ledger()[provider] = { usd: Math.round(usd * 100) / 100, at: new Date().toISOString().slice(0, 10), spent: 0 };
	save();
}

/** Для тестів: почати з чистого рахунку в іншій теці. */
export function resetLedgerCache(dataDir: string) {
	cache = null;
	dir = dataDir;
}
