<script lang="ts">
	import { onMount } from 'svelte';
	import { Office, type SceneInput, type Sky, type Thing } from '$lib/scene/office';
	import { ROLE_NAME, ROLES, type Role, type RunState, type Speaker, type Speech } from '$lib/types';

	type Target = Role | 'client' | Thing;
	let { run, hour, sky, bubbles = true, away = false, frozen = false, coffee = 0, reserve = 0, fill = false, onPick }: { run: RunState | null; hour: number; sky: Sky; bubbles?: boolean; away?: boolean; frozen?: boolean; coffee?: number; reserve?: number; fill?: boolean; onPick?: (what: Target, x: number, y: number) => void } = $props();

	let stage: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let office: Office | null = null;
	let raf = 0;
	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	/**
	 * Бабли йдуть чергою по кожному мовцю: репліка висить стільки, скільки треба її прочитати
	 * (1,8 с + 45 мс на знак, від 2,4 до 6,5 с). Якщо черга росте — поточна поступається раніше (після 1,6 с),
	 * а найстаріші зайві відкидаються: бабли не відстають від того, що реально відбувається.
	 * На паузі (і коли відкрите меню) бабли стоять.
	 */
	type Shown = Speech & { until: number; at: number };
	let shown = $state<Partial<Record<Speaker, Shown>>>({});
	const queue: Partial<Record<Speaker, Speech[]>> = {};
	let lastSeq = 0;
	let now = $state(Date.now());
	const dur = (t: string) => Math.min(6500, Math.max(2400, 1800 + t.length * 45));
	const MIN_SHOWN = 1600;
	let frozenAt = 0;

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
		if (frozen || run?.paused) {
			frozenAt ||= t;
			return;
		}
		if (frozenAt) {
			// після паузи кожен бабл досиджує свій залишок часу
			const d = t - frozenAt;
			frozenAt = 0;
			const next = { ...shown };
			for (const k of Object.keys(next) as Speaker[]) next[k] = { ...next[k]!, until: next[k]!.until + d, at: next[k]!.at + d };
			shown = next;
			return;
		}
		let changed = false;
		const next = { ...shown };
		for (const who of new Set([...Object.keys(queue), ...Object.keys(shown)]) as Set<Speaker>) {
			const cur = next[who];
			const q = queue[who];
			if (q && q.length > 2) q.splice(0, q.length - 2);
			if (cur && cur.until > t && !(q?.length && t - cur.at > MIN_SHOWN)) continue;
			if (q?.length) {
				const s = q.shift()!;
				next[who] = { ...s, at: t, until: t + dur(s.text) };
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

	/**
	 * Іноді хтось бере ноут і працює в кріслі біля вікна: на кожному кроці один з трьох (або ніхто),
	 * лише той, хто зараз думає за своїм столом.
	 */
	const lounge = $derived.by((): Role | null => {
		if (!run) return null;
		const key = `${run.id}:${run.phase}:${run.task?.done ?? 0}`;
		let h = 0;
		for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
		const r = ([...ROLES, null, null] as (Role | null)[])[h % 5];
		return r && run.agents[r].spot === 'desk' && run.agents[r].status === 'thinking' ? r : null;
	});
	const agents = $derived(
		run ? (Object.fromEntries(ROLES.map((r) => [r, r === lounge ? { ...run!.agents[r], spot: 'armchair' as const } : run!.agents[r]])) as RunState['agents']) : null
	);

	/** Скільки нотаток на дошці: рівно по ходу брифу — від розбору до оплати, 12 наприкінці. */
	function boardNotes(r: RunState): number {
		const RANK: Partial<Record<RunState['phase'], number>> = {
			read: 0, huddle: 1, position: 2, pick_position: 2, naming: 3, pick_name: 3, logo: 4, pick_logo: 4,
			player_core: 5, rework_core: 5, client_core: 5, client_decision_core: 5,
			content: 8, images: 9, player_content: 10, rework_content: 10, client_content: 10, client_decision_content: 10, done: 12, failed: 0
		};
		const base = RANK[r.phase] ?? 0;
		const rounds = r.verdicts.filter((v) => v.stage === (base >= 8 ? 'content' : 'core')).length;
		return Math.min(12, base + (base >= 5 && base < 8 ? Math.min(3, rounds) : base >= 10 && base < 12 ? Math.min(2, rounds) : 0));
	}

	const input = $derived<SceneInput>({
		agents: agents ?? {
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
			logo: !!run?.elements.logo,
			// з кожним кроком і колом на дошці більше нотаток
			notes: run ? boardNotes(run) : 0
		},
		logo: run?.elements.logo?.logo ?? null,
		hour,
		sky,
		reducedMotion: reduced,
		client: { gender: run?.brief.client.gender ?? 'm', look: run?.brief.client.look ?? 'leather' },
		away,
		coffee,
		clientMood: run?.verdicts.at(-1)?.mood
	});

	$effect(() => {
		// Спершу читаємо input — інакше, поки офісу ще нема, ефект не підпишеться на зміни.
		const i = input;
		office?.update(i);
	});
	$effect(() => {
		const v = { reserve, fill };
		office?.setView(v);
	});

	/**
	 * Камера. Тягнеш пальцем чи мишею — їде (коли є куди); коротке торкання — клік по людині чи предмету.
	 * Колесо миші, щипок на тачпаді (ctrl+wheel; у Safari — gesture*) і два пальці — наближення до точки під курсором.
	 * Подвійний клік чи тап по порожньому місцю — назад до всієї кімнати.
	 */
	const pts = new Map<number, { x: number; y: number }>();
	let pinch: { d: number; x: number; y: number } | null = null;
	let moved = false;
	let dragged = false;
	let panning = $state(false);
	let tap = { t: 0, x: 0, y: 0 };
	/** Клієнтські координати → CSS-пікселі всередині сцени (як у hit/thing/anchor). */
	const local = (cx: number, cy: number) => {
		const r = canvas.getBoundingClientRect();
		return { x: cx - r.left, y: cy - r.top };
	};
	function span() {
		const [a, b] = [...pts.values()];
		return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}
	function down(e: PointerEvent) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		// Перший палець чи миша — новий жест; загублені pointerup з минулого не заважають.
		if (e.isPrimary) pts.clear();
		if (!pts.size) moved = dragged = false;
		pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pts.size === 2) {
			pinch = span();
			moved = dragged = true;
		}
	}
	function move(e: PointerEvent) {
		const p = pts.get(e.pointerId);
		if (!p || !office) return;
		if (e.pointerType === 'mouse' && !(e.buttons & 1)) {
			pts.delete(e.pointerId);
			return;
		}
		if (pts.size >= 2) {
			p.x = e.clientX;
			p.y = e.clientY;
			if (!pinch) return;
			const n = span();
			// Точка арту між пальцями: спершу масштаб навколо старої середини, потім — туди, куди вона з'їхала.
			const o = local(pinch.x, pinch.y);
			if (pinch.d > 0 && n.d > 0) office.zoomAt(n.d / pinch.d, o.x, o.y);
			office.panBy(n.x - pinch.x, n.y - pinch.y);
			pinch = n;
			return;
		}
		const dx = e.clientX - p.x, dy = e.clientY - p.y;
		if (!moved) {
			if (Math.hypot(dx, dy) < 8 || !office.movable) return;
			moved = dragged = panning = true;
			try {
				canvas.setPointerCapture(e.pointerId);
			} catch {
				/* вказівник уже відпущено */
			}
		}
		office.panBy(dx, dy);
		p.x = e.clientX;
		p.y = e.clientY;
	}
	function up(e: PointerEvent) {
		if (!pts.delete(e.pointerId)) return;
		// Лишився один палець — далі просто тягне, без стрибка; два з трьох — щипок від нової пари.
		pinch = pts.size >= 2 ? span() : null;
		if (pts.size) return;
		panning = false;
		if (moved || e.type !== 'pointerup') return;
		const t = performance.now();
		if (t - tap.t < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 24) {
			tap.t = 0;
			// Другий клік уже не відкриває поп-ап у новому кадрі.
			if (office?.resetView()) dragged = true;
		} else tap = { t, x: e.clientX, y: e.clientY };
	}

	function wheel(e: WheelEvent) {
		if (!office) return;
		// Над офісом колесо й щипок — камера, а не прокрутка чи масштаб сторінки. Поза полотном усе як було.
		e.preventDefault();
		if (e.ctrlKey && gesture) return;
		const { x, y } = local(e.clientX, e.clientY);
		// Firefox рахує рядками (3 на клац колеса), Chrome — пікселями (~100 на клац).
		const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? canvas.clientHeight : 1;
		const dx = e.deltaX * unit, dy = e.deltaY * unit;
		if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) {
			office.panBy(-dx, 0);
			return;
		}
		// Щипок на тачпаді приходить як ctrl+wheel з дрібними кроками — чутливіше; клац колеса ≈ ×1,22.
		const k = e.ctrlKey ? 0.01 : 0.002;
		office.zoomAt(Math.exp(Math.max(-0.4, Math.min(0.4, -dy * k))), x, y);
	}
	// Safari на Mac: щипок тачпада — gesturestart/gesturechange з накопиченим scale, без ctrl+wheel.
	type Gesture = Event & { scale: number; clientX: number; clientY: number };
	let gesture = 0;
	function gstart(e: Event) {
		e.preventDefault();
		gesture = (e as Gesture).scale || 1;
	}
	function gchange(e: Event) {
		e.preventDefault();
		const g = e as Gesture;
		// На iPhone щипок уже рахують pointer-події двох пальців — тут лише гасимо масштаб сторінки.
		if (gesture && !pts.size && office && g.scale > 0) {
			const r = canvas.getBoundingClientRect();
			const p = Number.isFinite(g.clientX) ? local(g.clientX, g.clientY) : { x: r.width / 2, y: r.height / 2 };
			office.zoomAt(g.scale / gesture, p.x, p.y);
		}
		gesture = g.scale || gesture;
	}
	function gend(e: Event) {
		e.preventDefault();
		gesture = 0;
	}

	const els: Partial<Record<Speaker, HTMLElement>> = {};

	function place() {
		now = Date.now();
		advance(now);
		if (office && bubbles) {
			const w = stage.clientWidth;
			// Бабли не налазять: ставимо зліва направо, і той, що перетинається з уже поставленим, піднімаємо вище.
			const placed: { l: number; r: number; t: number; b: number }[] = [];
			// спершу всі виміри, потім усі записи: інакше кожен бабл змушує браузер перераховувати розкладку посеред кадру
			const items = live
				.map((s) => ({ s, el: els[s.who], a: office!.anchor(s.who), bw: els[s.who]?.offsetWidth ?? 0, bh: els[s.who]?.offsetHeight ?? 0 }))
				.sort((x, y) => (x.a?.y ?? 0) - (y.a?.y ?? 0));
			const h = stage.clientHeight;
			for (const { s, el, a, bw, bh } of items) {
				if (!el) continue;
				// Джіпітенко говорить з «екрана» в нижньому лівому куті — там порожня підлога, бабли людей не перекриває.
				if (s.who === 'gpt') {
					el.style.opacity = a ? '1' : '0';
					el.style.transform = `translate(8px, ${h - reserve - bh - 8}px)`;
					continue;
				}
				if (!a) {
					el.style.opacity = '0';
					continue;
				}
				const left = Math.min(Math.max(a.x - bw / 2, 6), w - bw - 6);
				// наближено мовець може бути нижче за видиме — бабл тоді біля нижнього краю, а не під шторкою
				let top = Math.min(a.y - bh - 4, h - reserve - bh - 6);
				for (let guard = 0; guard < 6; guard++) {
					const hit = placed.find((p) => left < p.r + 4 && left + bw > p.l - 4 && top < p.b + 4 && top + bh > p.t - 4);
					if (!hit) break;
					top = hit.t - bh - 6;
				}
				// не вище за кнопки «Пауза» і «Бриф»; якщо вгорі вже тісно — під тим, з ким перетнулись
				const minTop = fill ? 50 : 6;
				if (top < minTop) {
					top = minTop;
					for (let guard = 0; guard < 6; guard++) {
						const hit = placed.find((p) => left < p.r + 4 && left + bw > p.l - 4 && top < p.b + 4 && top + bh > p.t - 4);
						if (!hit) break;
						top = hit.b + 6;
					}
				}
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
		office.setView({ reserve, fill });
		if (import.meta.env.DEV) (window as unknown as { __office: Office }).__office = office;
		// Не пасивні: інакше preventDefault не спинить масштаб сторінки від щипка над офісом.
		const opt = { passive: false };
		canvas.addEventListener('wheel', wheel, opt);
		canvas.addEventListener('gesturestart', gstart, opt);
		canvas.addEventListener('gesturechange', gchange, opt);
		canvas.addEventListener('gestureend', gend, opt);
		raf = requestAnimationFrame(place);
		return () => {
			cancelAnimationFrame(raf);
			canvas.removeEventListener('wheel', wheel);
			canvas.removeEventListener('gesturestart', gstart);
			canvas.removeEventListener('gesturechange', gchange);
			canvas.removeEventListener('gestureend', gend);
			office?.destroy();
		};
	});

	/** Клієнт «друкує» репліку на очах: по ~35 знаків на секунду. */
	const typed = (s: Shown) => s.text.slice(0, Math.max(1, Math.floor((now - s.at) / 28)));
	const who = (s: Speaker) => (s === 'gpt' ? 'Джіпітенко' : s === 'client' ? run?.brief.client.name ?? 'Клієнт' : ROLE_NAME[s]);
</script>

<div class="stage" bind:this={stage}>
	<canvas
		bind:this={canvas}
		class:panning
		aria-label="Офіс агенції. Торкнись персонажа або предмета, щоб побачити, що можна зробити."
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onclick={(e) => {
			if (dragged) {
				dragged = false;
				return;
			}
			const r = canvas.getBoundingClientRect();
			const x = e.clientX - r.left, y = e.clientY - r.top;
			const what = office?.hit(x, y) ?? office?.thing(x, y);
			if (what && onPick) onPick(what, x, y);
		}}
	></canvas>
	{#if bubbles}
		{#each live as s (s.who)}
			<div class="bubble" class:gpt={s.who === 'gpt'} class:client={s.who === 'client'} class:sys={s.kind === 'system'} bind:this={els[s.who]}>
				<span class="who">{who(s.who)}{s.who === 'gpt' && s.to ? ` → ${ROLE_NAME[s.to].toLowerCase()}` : ''}</span>
				<span class="text">{s.who === 'gpt' && s.text.length > 170 ? `${s.text.slice(0, 168)}…` : s.who === 'client' ? typed(s) : s.text}</span>
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
		-webkit-user-select: none;
		user-select: none;
	}
	canvas {
		cursor: pointer;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		image-rendering: pixelated;
		/* жести над офісом — камері: без прокрутки, масштабу сторінки й подвійного тапу браузера */
		touch-action: none;
		&.panning {
			cursor: grabbing;
		}
	}
	.bubble {
		position: absolute;
		left: 0;
		top: 0;
		max-width: min(230px, 64%);
		padding: 7px 10px 8px;
		background: var(--paper);
		color: var(--paper-ink);
		border: 2px solid #3a2414;
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
			background: var(--paper);
			border-right: 2px solid #3a2414;
			border-bottom: 2px solid #3a2414;
			transform: rotate(45deg);
		}
		&.gpt {
			max-width: min(300px, 46%);
			border-color: #1f8f7a;
			background: #dff7ef;
			&::after {
				background: #dff7ef;
			}
			.who {
				color: #1f8f7a;
			}
			&::after {
				display: none;
			}
		}
		&.client {
			border-color: #a3392b;
			background: #fde6dc;
			&::after {
				background: #fde6dc;
			}
			.who {
				color: #a3392b;
			}
			&::after {
				border-color: #a3392b;
			}
		}
		&.sys .text {
			color: #6d5236;
			font-style: italic;
		}
	}
	.who {
		display: block;
		font-family: var(--pixel);
		font-size: 12px;
		color: #94785a;
		margin-bottom: 2px;
	}
</style>
