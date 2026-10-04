import type { BriefForm, GameState, Role, RunState } from './types';

type KB = Record<'strategist' | 'copywriter' | 'designer', number>;
type Init = { game: GameState; demo: boolean; imagesDemo: boolean; kb: KB };
export type Act =
	| { action: 'pick'; index: number }
	| { action: 'submit' | 'retry' | 'giveup' | 'drop' | 'continue' }
	| { action: 'edit'; notes: string[] }
	| { action: 'pause'; on: boolean };

/** Стан гри на клієнті: гра з сервера, активний бриф — живим потоком SSE. */
export class Live {
	game = $state<GameState | null>(null);
	demo = $state(true);
	imagesDemo = $state(true);
	kb = $state<KB | null>(null);
	run = $state<RunState | null>(null);
	error = $state<string | null>(null);
	busy = $state(false);
	/** Ключ рішення, яке гравець щойно відправив: вікно ховається одразу, не чекаючи сервера. */
	sent = $state<string | null>(null);
	/** Коротке повідомлення внизу сцени (кава зварилась, піца приїхала). */
	toast = $state<string | null>(null);
	private toastTimer: ReturnType<typeof setTimeout> | undefined;
	private es: EventSource | null = null;

	constructor(init: Init) {
		this.apply(init);
		if (init.game.activeRun) this.connect(init.game.activeRun);
	}

	private apply(j: Init) {
		this.game = j.game;
		this.demo = j.demo;
		this.imagesDemo = j.imagesDemo;
		this.kb = j.kb;
	}

	private async api<T>(url: string, body?: unknown): Promise<T | null> {
		this.error = null;
		try {
			const r = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
			const j = await r.json();
			if (!r.ok) {
				this.error = j.error ?? 'Щось пішло не так.';
				return null;
			}
			return j as T;
		} catch {
			this.error = 'Немає звʼязку з сервером.';
			return null;
		}
	}

	async refresh() {
		const j = await this.api<Init>('/api/game');
		if (j) this.apply(j);
	}

	connect(id: string) {
		this.es?.close();
		this.es = new EventSource(`/api/runs/${id}/events`);
		this.es.onmessage = (e) => {
			const d = JSON.parse(e.data) as { state: RunState };
			const wasDone = this.run?.phase === 'done';
			this.run = d.state;
			if (d.state.phase === 'done' && !wasDone) this.refresh();
		};
	}

	async start(input: { briefId?: string; custom?: BriefForm }) {
		this.busy = true;
		const j = await this.api<{ id: string; state: RunState }>('/api/runs', input);
		this.busy = false;
		if (!j) return false;
		this.run = j.state;
		this.connect(j.id);
		await this.refresh();
		return true;
	}

	say(text: string) {
		this.toast = text;
		clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => (this.toast = null), 3200);
	}

	/** Ключ поточного рішення: фаза + кількість вердиктів + чи ще можна правки. */
	static key(r: RunState | null) {
		return r ? `${r.phase}:${r.verdicts.length}:${r.editAvailable}` : '';
	}

	async act(body: Act) {
		if (!this.run) return false;
		const key = Live.key(this.run);
		if (body.action !== 'pause') this.sent = key;
		this.busy = true;
		const j = await this.api<{ state: RunState }>(`/api/runs/${this.run.id}/act`, body);
		this.busy = false;
		if (j) this.run = j.state;
		else this.sent = null;
		if (body.action === 'drop') await this.refresh();
		return !!j;
	}

	async gameAction(body: { action: 'rest' | 'reset' } | { action: 'balance'; provider: 'claude' | 'gemini'; usd: number } | { action: 'perk'; kind: 'coffee' | 'pizza' | 'praise'; role?: Role }) {
		this.busy = true;
		const j = await this.api<{ game: GameState }>('/api/game', body);
		this.busy = false;
		if (j) this.game = j.game;
		if (body.action === 'reset') {
			this.es?.close();
			this.run = null;
		}
		return !!j;
	}

	close() {
		this.es?.close();
	}
}
