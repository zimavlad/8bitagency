<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Live } from '$lib/live.svelte';
	import type { Sky } from '$lib/scene/office';
	import { ROLE_NAME } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import Inbox from '$lib/components/Inbox.svelte';
	import Num from '$lib/components/Num.svelte';
	import Scene from '$lib/components/Scene.svelte';
	import Team from '$lib/components/Team.svelte';
	import Work from '$lib/components/Work.svelte';

	let { data } = $props();
	const live = new Live(untrack(() => data));
	type Tab = 'inbox' | 'work' | 'team';
	let tab = $state<Tab>(live.game?.activeRun ? 'work' : 'inbox');
	let theme = $state<'dark' | 'light'>('dark');
	let hour = $state(new Date().getHours() + new Date().getMinutes() / 60);
	let sky = $state<Sky>('clear');
	let wide = $state(true);

	// Коли береш бриф — одразу показуємо роботу.
	$effect(() => {
		if (live.run && live.run.phase !== 'done' && tab === 'inbox') tab = 'work';
	});

	let clock: ReturnType<typeof setInterval>;
	onMount(() => {
		theme = (document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark';
		const q = new URLSearchParams(location.search);
		const fh = q.get('h');
		if (fh !== null) hour = Number(fh);
		else clock = setInterval(() => (hour = new Date().getHours() + new Date().getMinutes() / 60), 60_000);
		fetch(`/api/weather${q.get('w') ? `?w=${q.get('w')}` : ''}`).then((r) => r.json()).then((j) => (sky = j.sky)).catch(() => {});
		const mq = matchMedia('(min-width: 860px)');
		wide = mq.matches;
		mq.addEventListener('change', (e) => (wide = e.matches));
	});
	onDestroy(() => {
		clearInterval(clock);
		live.close();
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('theme', theme);
		} catch {
			// приватний режим
		}
	}

	const g = $derived(live.game!);
	const last = $derived(live.run?.speech.at(-1));
	const lastWho = $derived(last ? (last.who === 'gpt' ? 'Джіпітенко' : last.who === 'client' ? live.run!.brief.client.name : ROLE_NAME[last.who]) : '');
	const tabs: { id: Tab; label: string; icon: 'inbox' | 'work' | 'team' }[] = [
		{ id: 'inbox', label: 'Брифи', icon: 'inbox' },
		{ id: 'work', label: 'Робота', icon: 'work' },
		{ id: 'team', label: 'Команда', icon: 'team' }
	];
</script>

<svelte:head><title>8bitagency — гра про агенцію</title></svelte:head>

<div class="app">
	<header class="top">
		<div class="brand">8bitagency</div>
		{#if live.demo}<span class="demo" title="Без ключа Claude відповідає підставна модель">демо</span>{/if}
		<div class="hud">
			<span class="kpi" title="День"><span class="faint dw">день</span> <span class="num">{g.day}</span></span>
			<span class="kpi" title="Гроші"><Icon name="coin" size={16} /><Num value={g.money} width={7} suffix=" ₴" /></span>
			<span class="kpi" title="Репутація в індустрії"><Icon name="star" size={16} /><Num value={g.reputation} width={3} /></span>
		</div>
		<button class="btn ghost sm theme" onclick={toggleTheme} aria-label="Змінити тему"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} /></button>
	</header>

	<main class="main">
		<div class="scene">
			<Scene run={live.run} {hour} {sky} bubbles={wide} />
		</div>
		{#if !wide}
			<div class="dialog" aria-live="polite">
				{#if last && live.run?.phase !== 'done'}
					<b>{lastWho}</b> <span>{last.text}</span>
				{:else}
					<span class="faint">{live.run?.status ?? 'Офіс чекає на бриф.'}</span>
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
						<button class="btn primary" onclick={() => live.game_('reset')}>Нова гра</button>
					</div>
				{/if}
				{#if tab === 'inbox'}
					<Inbox {live} />
				{:else if tab === 'work'}
					{#if live.run}
						<Work {live} onNext={() => { live.run = null; tab = 'inbox'; }} />
					{:else}
						<p class="muted">Зараз команда без брифу. Візьми щось у вхідних.</p>
						<button class="btn primary" onclick={() => (tab = 'inbox')}>До брифів</button>
					{/if}
				{:else}
					<Team {live} />
				{/if}
				{#if live.error && tab !== 'work'}<p class="err">{live.error}</p>{/if}
			</div>
		</aside>
	</main>

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
		border-bottom: 1px solid var(--line);
		background: var(--surface-1);
		position: sticky;
		top: 0;
		z-index: 5;
	}
	.brand {
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.demo {
		font-size: 11px;
		color: var(--human);
		border: 1px solid var(--human);
		border-radius: 999px;
		padding: 0 7px;
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
	.scene {
		height: min(calc((100vw - 32px) * 270 / 358), 46dvh);
		min-height: 220px;
		margin: 12px 16px 0;
		border: 1px solid var(--line);
		border-radius: 2px;
		overflow: hidden;
	}
	.dialog {
		margin: 8px 16px 0;
		min-height: 48px;
		font-size: 14px;
		line-height: 1.45;
		padding: 8px 12px;
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: var(--surface-1);
		b {
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
		border-top: 1px solid var(--line);
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
			border-radius: 999px;
			border: 1px solid var(--line);
			color: var(--text-2);
			font-size: 14px;
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
	.theme {
		flex: 0 0 auto;
		padding: 0 8px;
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
			font-size: 14px;
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
