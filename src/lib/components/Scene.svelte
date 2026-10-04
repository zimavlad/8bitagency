<script lang="ts">
	import { onMount } from 'svelte';
	import { Office, type SceneInput, type Sky } from '$lib/scene/office';
	import { ROLE_NAME, ROLES, type Role, type RunState, type Speaker, type Speech } from '$lib/types';

	let { run, hour, sky, bubbles = true, away = false, onPick }: { run: RunState | null; hour: number; sky: Sky; bubbles?: boolean; away?: boolean; onPick?: (who: Role | 'client') => void } = $props();

	let stage: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let office: Office | null = null;
	let raf = 0;
	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	/**
	 * Бабли йдуть чергою по кожному мовцю: репліка висить стільки, скільки треба її прочитати
	 * (2,2 с + 55 мс на знак, від 3 до 9 с), наступна чекає своєї черги — нічого не проскакує.
	 */
	type Shown = Speech & { until: number };
	let shown = $state<Partial<Record<Speaker, Shown>>>({});
	const queue: Partial<Record<Speaker, Speech[]>> = {};
	let lastSeq = 0;
	let now = $state(Date.now());
	const dur = (t: string) => Math.min(9000, Math.max(3000, 2200 + t.length * 55));

	$effect(() => {
		const sp = run?.speech ?? [];
		if (!run) {
			shown = {};
			lastSeq = 0;
			return;
		}
		for (const s of sp) if (s.seq > lastSeq) (queue[s.who] ??= []).push(s);
		lastSeq = Math.max(lastSeq, ...sp.map((s) => s.seq));
	});

	function advance(t: number) {
		let changed = false;
		const next = { ...shown };
		for (const who of new Set([...Object.keys(queue), ...Object.keys(shown)]) as Set<Speaker>) {
			const cur = next[who];
			if (cur && cur.until > t) continue;
			const q = queue[who];
			if (q?.length) {
				const s = q.shift()!;
				next[who] = { ...s, until: t + dur(s.text) };
				changed = true;
			} else if (cur) {
				delete next[who];
				changed = true;
			}
		}
		if (changed) shown = next;
	}

	const live = $derived(Object.values(shown).filter((s): s is Shown => !!s));

	const gptFor = $derived.by((): Role | null => {
		const asking = run ? ROLES.find((r) => run!.agents[r].status === 'gpt') : undefined;
		if (asking) return asking;
		const g = shown.gpt;
		return g && g.to ? g.to : null;
	});

	const input = $derived<SceneInput>({
		agents: run?.agents ?? {
			strategist: { spot: 'desk', status: 'idle', burnout: 0 },
			copywriter: { spot: 'desk', status: 'idle', burnout: 0 },
			designer: { spot: 'desk', status: 'idle', burnout: 0 }
		},
		clientInOffice: run?.clientInOffice ?? false,
		gptFor,
		speaking: live.map((s) => s.who),
		board: {
			positioning: !!run?.elements.positioning,
			name: !!run?.elements.name,
			slogan: !!run?.elements.slogan,
			logo: !!run?.elements.logo
		},
		logo: run?.elements.logo?.logo ?? null,
		hour,
		sky,
		reducedMotion: reduced,
		client: { gender: run?.brief.client.gender ?? 'm', look: run?.brief.client.look ?? 'leather' },
		away
	});

	$effect(() => {
		// Спершу читаємо input — інакше, поки офісу ще нема, ефект не підпишеться на зміни.
		const i = input;
		office?.update(i);
	});

	const els: Partial<Record<Speaker, HTMLElement>> = {};

	function place() {
		now = Date.now();
		advance(now);
		if (office && bubbles) {
			const w = stage.clientWidth;
			// Бабли не налазять: ставимо зліва направо, і той, що перетинається з уже поставленим, піднімаємо вище.
			const placed: { l: number; r: number; t: number; b: number }[] = [];
			const items = live
				.map((s) => ({ s, el: els[s.who], a: office!.anchor(s.who) }))
				.sort((x, y) => (x.a?.y ?? 0) - (y.a?.y ?? 0));
			for (const { el, a } of items) {
				if (!el) continue;
				if (!a) {
					el.style.opacity = '0';
					continue;
				}
				const bw = el.offsetWidth, bh = el.offsetHeight;
				const left = Math.min(Math.max(a.x - bw / 2, 6), w - bw - 6);
				let top = a.y - bh - 4;
				for (let guard = 0; guard < 6; guard++) {
					const hit = placed.find((p) => left < p.r + 4 && left + bw > p.l - 4 && top < p.b + 4 && top + bh > p.t - 4);
					if (!hit) break;
					top = hit.t - bh - 6;
				}
				top = Math.max(6, top);
				placed.push({ l: left, r: left + bw, t: top, b: top + bh });
				el.style.opacity = '1';
				el.style.transform = `translate(${left}px, ${top}px)`;
				el.style.setProperty('--tail', `${Math.min(Math.max(a.x - left, 14), bw - 14)}px`);
			}
		}
		raf = requestAnimationFrame(place);
	}

	onMount(() => {
		office = new Office(canvas, stage, input);
		if (import.meta.env.DEV) (window as unknown as { __office: Office }).__office = office;
		raf = requestAnimationFrame(place);
		return () => {
			cancelAnimationFrame(raf);
			office?.destroy();
		};
	});

	const who = (s: Speaker) => (s === 'gpt' ? 'Джіпітенко' : s === 'client' ? run?.brief.client.name ?? 'Клієнт' : ROLE_NAME[s]);
</script>

<div class="stage" bind:this={stage}>
	<canvas
		bind:this={canvas}
		aria-label="Офіс агенції. Торкнись персонажа, щоб прочитати його думки."
		onclick={(e) => {
			const r = canvas.getBoundingClientRect();
			const who = office?.hit(e.clientX - r.left, e.clientY - r.top);
			if (who && onPick) onPick(who);
		}}
	></canvas>
	{#if bubbles}
		{#each live as s (s.who)}
			<div class="bubble" class:gpt={s.who === 'gpt'} class:client={s.who === 'client'} class:sys={s.kind === 'system'} bind:this={els[s.who]}>
				<span class="who">{who(s.who)}</span>
				<span class="text">{s.text}</span>
			</div>
		{/each}
	{/if}
</div>

<style lang="scss">
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--scene-bg);
	}
	canvas {
		cursor: pointer;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		image-rendering: pixelated;
	}
	.bubble {
		position: absolute;
		left: 0;
		top: 0;
		max-width: min(230px, 64%);
		padding: 7px 10px 8px;
		background: var(--surface-2);
		border: 1px solid var(--line-hi);
		border-radius: var(--r-sm);
		font-size: 12.5px;
		line-height: 1.4;
		opacity: 0;
		pointer-events: none;
		white-space: pre-line;
		transition: opacity var(--t) var(--ease);
		&::after {
			content: '';
			position: absolute;
			bottom: -6px;
			left: calc(var(--tail, 50%) - 6px);
			width: 10px;
			height: 10px;
			background: var(--surface-2);
			border-right: 1px solid var(--line-hi);
			border-bottom: 1px solid var(--line-hi);
			transform: rotate(45deg);
		}
		&.gpt {
			border-color: #2fae95;
			.who {
				color: #5ee6c8;
			}
			&::after {
				border-color: #2fae95;
			}
		}
		&.client {
			border-color: var(--bad);
			.who {
				color: var(--bad);
			}
			&::after {
				border-color: var(--bad);
			}
		}
		&.sys .text {
			color: var(--text-2);
			font-style: italic;
		}
	}
	.who {
		display: block;
		font-size: 11px;
		color: var(--text-3);
		margin-bottom: 2px;
	}
</style>
