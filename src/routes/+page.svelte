<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Live } from '$lib/live.svelte';
	import type { Sky, Thing } from '$lib/scene/office';
	import { ROLE_NAME, tierOf, type Role } from '$lib/types';
	import Decision from '$lib/components/Decision.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Inbox from '$lib/components/Inbox.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Num from '$lib/components/Num.svelte';
	import Popover from '$lib/components/Popover.svelte';
	import Scene from '$lib/components/Scene.svelte';
	import Team from '$lib/components/Team.svelte';
	import Thoughts from '$lib/components/Thoughts.svelte';
	import Work from '$lib/components/Work.svelte';

	let { data } = $props();
	const live = new Live(untrack(() => data));
	type Tab = 'inbox' | 'work' | 'team';
	let tab = $state<Tab>(live.game?.activeRun ? 'work' : 'inbox');
	let screen = $state<'title' | 'game'>('title');
	let menu = $state(false);
	let menuPaused = false;
	let hour = $state(new Date().getHours() + new Date().getMinutes() / 60);
	let sky = $state<Sky>('clear');
	let wide = $state(true);
	let away = $state(false);
	let open = $state<Role | 'client' | null>(null);
	let pop = $state<{ what: Role | 'client' | Thing; x: number; y: number } | null>(null);
	let sceneEl = $state<HTMLDivElement>();
	let minimized = $state(false);
	let waiting = $state(false);

	const g = $derived(live.game!);
	const run = $derived(live.run);
	const active = $derived(!!run && run.phase !== 'done' && run.phase !== 'failed');
	const canContinue = $derived(!!g.activeRun || g.day > 1 || g.history.length > 0);
	/** Скільки тримати вердикт, поки клієнт договорює репліки над головою. */
	const talk = $derived(wide ? (run?.verdicts.at(-1)?.lines.length ?? 0) * 2600 + 500 : 700);

	/** Вихідний: усі виходять у двері, офіс порожніє, наступного ранку повертаються. */
	async function dayOff() {
		away = true;
		live.say('Команда пішла на вихідний');
		await new Promise((r) => setTimeout(r, 2600));
		const ok = await live.gameAction({ action: 'rest' });
		if (ok) live.say('Офіс порожній. Ранок нового дня…');
		await new Promise((r) => setTimeout(r, 1800));
		away = false;
		if (ok) live.say('Повернулись відпочилими: стрес −35, мораль +10');
	}

	function openMenu() {
		menu = true;
		if (active && !run!.paused) {
			menuPaused = true;
			live.act({ action: 'pause', on: true });
		}
	}
	function closeMenu() {
		menu = false;
		screen = 'game';
		if (menuPaused && run?.paused) live.act({ action: 'pause', on: false });
		menuPaused = false;
	}
	async function newGame() {
		await live.gameAction({ action: 'reset' });
		menu = false;
		menuPaused = false;
		screen = 'game';
		tab = 'inbox';
	}

	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || screen === 'title') return;
		if (pop) pop = null;
		else if (open) open = null;
		else if (menu) closeMenu();
		else openMenu();
	}

	// Коли береш бриф — одразу показуємо роботу.
	$effect(() => {
		if (live.run && live.run.phase !== 'done' && tab === 'inbox') tab = 'work';
	});

	let clock: ReturnType<typeof setInterval>;
	onMount(() => {
		const q = new URLSearchParams(location.search);
		const fh = q.get('h');
		if (fh !== null) hour = Number(fh);
		else clock = setInterval(() => (hour = new Date().getHours() + new Date().getMinutes() / 60), 60_000);
		if (q.has('play')) screen = 'game';
		fetch(`/api/weather${q.get('w') ? `?w=${q.get('w')}` : ''}`).then((r) => r.json()).then((j) => (sky = j.sky)).catch(() => {});
		const mq = matchMedia('(min-width: 860px)');
		wide = mq.matches;
		mq.addEventListener('change', (e) => (wide = e.matches));
	});
	onDestroy(() => {
		clearInterval(clock);
		live.close();
	});

	const last = $derived(live.run?.speech.at(-1));
	const lastWho = $derived(last ? (last.who === 'gpt' ? 'Джіпітенко' : last.who === 'client' ? live.run!.brief.client.name : ROLE_NAME[last.who]) : '');
	const tabs: { id: Tab; label: string; icon: 'inbox' | 'work' | 'team' }[] = [
		{ id: 'inbox', label: 'Брифи', icon: 'inbox' },
		{ id: 'work', label: 'Робота', icon: 'work' },
		{ id: 'team', label: 'Пульт', icon: 'team' }
	];
</script>

<svelte:window onkeydown={onKey} />
<svelte:head><title>8bitagency — гра про агенцію</title></svelte:head>

{#if screen === 'title'}
	<Menu mode="title" {canContinue} onContinue={closeMenu} onNew={newGame} onTitle={() => {}} />
{:else if menu}
	<Menu mode="pause" canContinue onContinue={closeMenu} onNew={newGame} onTitle={() => { menu = false; screen = 'title'; }} />
{/if}

<div class="app">
	<header class="top">
		<button class="brand" onclick={openMenu} title="Меню (Esc)">8bitagency</button>
		{#if live.demo}<span class="demo" title="Без ключа Claude відповідає підставна модель">демо</span>{/if}
		<div class="hud">
			<span class="kpi" title="День"><span class="faint dw">день</span> <span class="num">{g.day}</span></span>
			<span class="kpi" title="Гроші"><Icon name="coin" size={16} /><Num value={g.money} width={6} suffix=" ₴" /></span>
			<span class="kpi" title="Репутація; рівень агенції"><Icon name="star" size={16} /><Num value={g.reputation} width={3} /><span class="faint lvl">рів. {tierOf(g.reputation)}</span></span>
			<span class="kpi bal" title="Орієнтовний залишок на рахунках API"><span class="faint">Claude</span> <span class="num">${Math.max(0, g.ledger.claude.usd - g.ledger.claude.spent).toFixed(2)}</span> <span class="faint">Gemini</span> <span class="num">${Math.max(0, g.ledger.gemini.usd - g.ledger.gemini.spent).toFixed(2)}</span></span>
		</div>
		<button class="btn ghost sm menu-btn" onclick={openMenu} aria-label="Меню"><Icon name="menu" size={18} /></button>
	</header>

	<main class="main">
		<div class="scene" bind:this={sceneEl}>
			<Scene run={live.run} {hour} {sky} bubbles={wide} {away} frozen={menu || screen === 'title'} onPick={(what, x, y) => (pop = { what, x, y })} />
			{#if run?.paused && !menu}<div class="paused px">Пауза</div>{/if}
			{#if live.toast}<div class="toast px rise">{live.toast}</div>{/if}
			{#if waiting && minimized}<button class="btn human yourturn" onclick={() => (minimized = false)}><Icon name="play" size={16} />Твій хід</button>{/if}
			{#if pop && sceneEl}
				<Popover {live} what={pop.what} x={pop.x} y={pop.y} w={sceneEl.clientWidth} h={sceneEl.clientHeight} onClose={() => (pop = null)} onThoughts={(w) => { pop = null; open = w; }} onRest={dayOff} />
			{/if}
		</div>
		{#if !wide}
			<div class="dialog" aria-live="polite">
				{#if last && live.run?.phase !== 'done'}
					<b>{lastWho}</b> <span>{last.text}</span>
				{:else}
					<span class="faint">{live.run?.status ?? 'Офіс чекає на бриф. Торкнись людей і предметів.'}</span>
				{/if}
			</div>
		{/if}

		<aside class="side">
			{#if wide}
				<nav class="tabs-top">
					{#each tabs as t}
						<button class:on={tab === t.id} onclick={() => (tab = t.id)}><Icon name={t.icon} size={16} />{t.label}</button>
					{/each}
				</nav>
			{/if}
			<div class="content">
				{#if g.bankrupt}
					<div class="panel bankrupt">
						<h2>Агенція збанкрутувала</h2>
						<p class="muted">Гроші скінчились. Таке буває навіть з чесними агенціями.</p>
						<button class="btn primary" onclick={newGame}>Нова гра</button>
					</div>
				{/if}
				{#if tab === 'inbox'}
					<Inbox {live} />
				{:else if tab === 'work'}
					{#if live.run}
						<Work {live} waiting={waiting && minimized} onOpen={() => (minimized = false)} />
					{:else}
						<p class="muted">Зараз команда без брифу. Візьми щось у вхідних.</p>
						<button class="btn primary" onclick={() => (tab = 'inbox')}>До брифів</button>
					{/if}
				{:else}
					<Team {live} onRest={dayOff} onOpen={(r) => (open = r)} />
				{/if}
				{#if live.error && tab !== 'work'}<p class="err">{live.error}</p>{/if}
			</div>
		</aside>
	</main>

	{#if live.run && screen === 'game'}
		<Decision {live} {talk} bind:minimized bind:waiting onDone={() => { live.run = null; tab = 'inbox'; }} />
	{/if}
	{#if open}<Thoughts who={open} run={live.run} onClose={() => (open = null)} />{/if}

	{#if !wide}
		<nav class="tabs-bottom">
			{#each tabs as t}
				<button class:on={tab === t.id} onclick={() => (tab = t.id)}><Icon name={t.icon} size={20} /><span>{t.label}</span></button>
			{/each}
		</nav>
	{/if}
</div>

<style lang="scss">
	.app {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding-left: env(safe-area-inset-left);
		padding-right: env(safe-area-inset-right);
	}
	.top {
		height: var(--top-h);
		padding: env(safe-area-inset-top) 16px 0;
		display: flex;
		align-items: center;
		gap: 12px;
		border-bottom: 3px solid #120a06;
		background: var(--surface-1);
		position: sticky;
		top: 0;
		z-index: 5;
	}
	.brand {
		font-family: var(--title);
		font-size: 14px;
		color: var(--human);
	}
	.lvl {
		font-family: var(--pixel);
		font-size: 12px;
	}
	.menu-btn {
		flex: 0 0 auto;
		padding: 0 8px 2px;
	}
	.paused {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: 28px;
		color: var(--human);
		pointer-events: none;
		background: rgba(18, 12, 9, 0.7);
		padding: 4px 16px 6px;
	}
	.toast {
		position: absolute;
		left: 50%;
		bottom: 12px;
		transform: translateX(-50%);
		padding: 6px 12px 7px;
		background: var(--paper);
		color: var(--paper-ink);
		border: 2px solid #3a2414;
		font-size: 14px;
		white-space: nowrap;
		max-width: calc(100% - 24px);
		overflow: hidden;
		text-overflow: ellipsis;
		z-index: 4;
	}
	.yourturn {
		position: absolute;
		right: 12px;
		top: 12px;
		z-index: 5;
	}
	.demo {
		font-family: var(--pixel);
		font-size: 12px;
		color: var(--human);
		border: 2px solid var(--human);
		padding: 0 6px;
	}
	.hud {
		margin-left: auto;
		display: flex;
		gap: 14px;
		font-size: 13px;
	}
	.kpi {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--text-2);
	}
	.main {
		flex: 1;
		display: grid;
		grid-template-rows: auto auto 1fr;
	}

	.bal {
		gap: 4px;
	}
	@media (max-width: 640px) {
		.bal {
			display: none;
		}
	}
	.scene {
		position: relative;
		height: min(calc((100vw - 32px) * 270 / 358), 46dvh);
		min-height: 220px;
		margin: 12px 16px 0;
		border: 3px solid transparent;
		border-image: var(--frame) 3 / 3px stretch;
		overflow: hidden;
	}
	.dialog {
		margin: 8px 16px 0;
		min-height: 48px;
		font-size: 14px;
		line-height: 1.45;
		padding: 8px 12px;
		border: 2px solid #3a2414;
		background: var(--paper);
		color: var(--paper-ink);
		b {
			font-family: var(--pixel);
			font-weight: 600;
			margin-right: 4px;
		}
	}
	.side {
		padding: 12px 16px calc(var(--tabs-h) + 16px + env(safe-area-inset-bottom));
	}
	.content {
		display: grid;
		gap: 12px;
	}
	.tabs-bottom {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		height: calc(var(--tabs-h) + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		background: var(--surface-1);
		border-top: 3px solid #120a06;
		z-index: 5;
		button {
			display: grid;
			justify-items: center;
			align-content: center;
			gap: 2px;
			font-size: 11px;
			color: var(--text-3);
			transition: color var(--t) var(--ease);
			&.on {
				color: var(--accent);
			}
		}
	}
	.tabs-top {
		display: flex;
		gap: 4px;
		margin-bottom: 12px;
		button {
			display: inline-flex;
			gap: 6px;
			align-items: center;
			padding: 6px 12px;
			border: 2px solid var(--line);
			background: #1f150f;
			color: var(--text-2);
			font-family: var(--pixel);
			font-size: 15px;
			transition: all var(--t) var(--ease);
			&:hover {
				border-color: var(--line-hi);
			}
			&.on {
				border-color: var(--accent);
				color: var(--accent);
			}
		}
	}
	.bankrupt {
		padding: 14px;
		display: grid;
		gap: 8px;
		border-color: var(--bad);
	}
	.err {
		color: var(--bad);
		font-size: 14px;
	}

	@media (max-width: 420px) {
		.top {
			gap: 8px;
			padding-left: 12px;
			padding-right: 12px;
		}
		.hud {
			gap: 8px;
		}
		.dw {
			display: none;
		}
		.brand {
			font-size: 10px;
		}
		.lvl,
		.demo {
			display: none;
		}
		.kpi {
			gap: 3px;
			white-space: nowrap;
		}
	}
	@media (min-width: 860px) {
		.app {
			height: 100dvh;
			overflow: hidden;
		}
		.main {
			grid-template-columns: 1fr minmax(360px, 420px);
			grid-template-rows: 1fr;
			height: calc(100dvh - var(--top-h));
		}
		.scene {
			height: auto;
			min-height: 0;
			margin: 16px;
		}
		.side {
			min-height: 0;
			padding: 16px 16px 24px 0;
			overflow: auto;
		}
	}
</style>
