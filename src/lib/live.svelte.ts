import type { ElementId, GameState, RunState } from './types';

type KB = Record<'strategist' | 'copywriter' | 'designer', number>;

/** Стан гри на клієнті: гра з сервера, активний бриф — живим потоком SSE. */
export class Live {
	game = $state<GameState | null>(null);
	demo = $state(true);
	kb = $state<KB | null>(null);
	run = $state<RunState | null>(null);
	editsLeft = $state<ElementId[]>([]);
	error = $state<string | null>(null);
	busy = $state(false);
	private es: EventSource | null = null;

	constructor(init: { game: GameState; demo: boolean; kb: KB }) {
		this.game = init.game;
		this.demo = init.demo;
		this.kb = init.kb;
		if (init.game.activeRun) this.connect(init.game.activeRun);
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
		const j = await this.api<{ game: GameState; demo: boolean; kb: KB }>('/api/game');
		if (j) {
			this.game = j.game;
			this.demo = j.demo;
			this.kb = j.kb;
		}
	}

	connect(id: string) {
		this.es?.close();
		this.es = new EventSource(`/api/runs/${id}/events`);
		this.es.onmessage = (e) => {
			const d = JSON.parse(e.data) as { state: RunState; editsLeft: ElementId[] };
			const wasDone = this.run?.phase === 'done';
			this.run = d.state;
			this.editsLeft = d.editsLeft;
			if (d.state.phase === 'done' && !wasDone) this.refresh();
		};
		this.es.onerror = () => {
			// EventSource перепідключається сам; після перепідключення сервер одразу шле повний стан.
		};
	}

	async start(input: { briefId?: string; custom?: { text: string; business: string } }) {
		this.busy = true;
		const j = await this.api<{ id: string; state: RunState }>('/api/runs', input);
		this.busy = false;
		if (!j) return false;
		this.run = j.state;
		this.connect(j.id);
		await this.refresh();
		return true;
	}

	async act(body: { action: 'edit' | 'approve' | 'submit' | 'drop'; element?: ElementId; comment?: string }) {
		if (!this.run) return false;
		this.busy = body.action !== 'edit';
		const j = await this.api<{ state: RunState; editsLeft: ElementId[] }>(`/api/runs/${this.run.id}/act`, body);
		this.busy = false;
		if (j) {
			this.run = j.state;
			this.editsLeft = j.editsLeft;
		}
		if (body.action === 'drop') await this.refresh();
		return !!j;
	}

	async game_(action: 'rest' | 'reset') {
		this.busy = true;
		const j = await this.api<{ game: GameState }>('/api/game', { action });
		this.busy = false;
		if (j) this.game = j.game;
		if (action === 'reset') {
			this.es?.close();
			this.run = null;
		}
	}

	close() {
		this.es?.close();
	}
}
