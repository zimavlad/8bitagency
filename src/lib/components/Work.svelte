<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { CONTENT, CORE, EDIT_SLOTS, MAX_CLIENT_ROUNDS, ROLE_NAME, type ClientVerdict, type RunPhase } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import ElementCard from './ElementCard.svelte';
	import Icon from './Icon.svelte';
	import Num from './Num.svelte';

	let { live, onNext }: { live: Live; onNext: () => void } = $props();
	const run = $derived(live.run!);

	const STEPS: { label: string; phases: RunPhase[]; you?: boolean }[] = [
		{ label: 'Стратегія', phases: ['read', 'huddle', 'position'] },
		{ label: 'Назва', phases: ['naming', 'pick_name'] },
		{ label: 'Лого', phases: ['logo'] },
		{ label: 'Ти', phases: ['player_core', 'rework_core'], you: true },
		{ label: 'Клієнт', phases: ['client_core', 'client_decision_core'] },
		{ label: 'Канали', phases: ['content', 'images'] },
		{ label: 'Ти', phases: ['player_content', 'rework_content'], you: true },
		{ label: 'Клієнт', phases: ['client_content', 'client_decision_content'] },
		{ label: 'Оплата', phases: ['done'] }
	];
	const stepIdx = $derived(STEPS.findIndex((s) => s.phases.includes(run.phase)));
	const playerTurn = $derived(run.phase === 'player_core' || run.phase === 'player_content');
	const deciding = $derived(run.phase === 'client_decision_core' || run.phase === 'client_decision_content');
	const waitingYou = $derived(playerTurn || deciding || run.phase === 'pick_name');
	const coreIds = $derived(CORE.filter((id) => run.elements[id]));
	const contentIds = $derived(CONTENT.filter((id) => run.elements[id]));
	const lastVerdict = $derived<ClientVerdict | undefined>(run.verdicts.at(-1));

	let editing = $state(false);
	let notes = $state<string[]>(Array(EDIT_SLOTS).fill(''));
	async function sendEdits() {
		if (await live.act({ action: 'edit', notes })) {
			editing = false;
			notes = Array(EDIT_SLOTS).fill('');
		}
	}
</script>

<section class="wrap">
	<header class="brief">
		<Avatar who="client" client={run.brief.client} size={44} />
		<div class="bw">
			<div class="client">{run.brief.client.name}</div>
			<div class="faint biz">{run.brief.client.business}</div>
		</div>
		<div class="fee"><Num value={run.brief.fee} width={7} suffix=" ₴" /></div>
	</header>
	<p class="muted quote">«{run.brief.text}»</p>

	<ol class="steps" aria-label="Етапи брифу">
		{#each STEPS as s, i}
			<li class:done={i < stepIdx} class:now={i === stepIdx} class:you={s.you}>{s.label}</li>
		{/each}
	</ol>

	<div class="status panel" class:you={waitingYou} aria-live="polite">
		{#if run.paused}<Icon name="pause" size={16} />{:else if !waitingYou && run.phase !== 'done' && run.phase !== 'failed'}<span class="spin"></span>{/if}
		<span>{run.paused ? 'Пауза — читай спокійно' : run.status}</span>
	</div>
	{#if run.error}<p class="err">{run.error}</p>{/if}
	{#if live.error}<p class="err">{live.error}</p>{/if}

	{#if run.phase === 'pick_name'}
		<div class="pick rise">
			<p class="label">Копірайтер пропонує три варіанти. Обери один — під нього дизайнер малюватиме знак.</p>
			{#each run.options as o, i}
				<button class="option panel" disabled={live.busy} onclick={() => live.act({ action: 'pick', index: i })}>
					<span class="oname">{o.name}</span>
					<span class="oslogan">«{o.slogan}»</span>
					<span class="faint owhy">{o.why}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if coreIds.length}
		<h3>Основа бренду</h3>
		{#each coreIds as id (id)}<ElementCard el={run.elements[id]!} />{/each}
	{/if}

	{#each run.verdicts.filter((v) => v.stage === 'core') as v}
		{@render verdict(v)}
	{/each}

	{#if contentIds.length}
		<h3>Канали</h3>
		{#each contentIds as id (id)}<ElementCard el={run.elements[id]!} />{/each}
	{/if}

	{#each run.verdicts.filter((v) => v.stage === 'content') as v}
		{@render verdict(v)}
	{/each}

	{#if playerTurn}
		<div class="act panel rise">
			{#if editing}
				<p class="label">До трьох правок одразу. Порожнє поле — нічого не міняти. Команда перегляне все узгоджено: якщо зміниться позиціонування, підтягнуться і назва, і знак.</p>
				{#each notes as _, i}
					<textarea rows="2" maxlength="280" placeholder="Правка {i + 1}" bind:value={notes[i]}></textarea>
				{/each}
				<div class="row">
					<button class="btn ghost" onclick={() => (editing = false)}>Скасувати</button>
					<button class="btn primary" disabled={live.busy || !notes.some((n) => n.trim())} onclick={sendEdits}><Icon name="send" size={16} />Віддати правки</button>
				</div>
			{:else}
				<button class="btn primary wide" disabled={live.busy} onclick={() => live.act({ action: 'submit' })}><Icon name="send" size={16} />Показати клієнту</button>
				{#if run.editAvailable}
					<button class="btn human wide" onclick={() => (editing = true)}><Icon name="edit" size={16} />Дати правки</button>
				{:else}
					<p class="faint small">Раунд правок на цьому етапі використано.</p>
				{/if}
			{/if}
		</div>
	{/if}

	{#if deciding && lastVerdict}
		<div class="act panel rise">
			<p class="label">Клієнт хоче правок. Коло {lastVerdict.round} з {MAX_CLIENT_ROUNDS}: команда переробить усе узгоджено з його вимогами, або можна здатися.</p>
			<div class="row">
				<button class="btn ghost" disabled={live.busy} onclick={() => live.act({ action: 'giveup' })}><Icon name="x" size={16} />Здатися</button>
				<button class="btn primary" disabled={live.busy} onclick={() => live.act({ action: 'retry' })}><Icon name="reset" size={16} />Ще коло</button>
			</div>
		</div>
	{/if}

	{#if run.result}
		<article class="result panel rise">
			<h3>{run.result.verdict === 'ok' ? 'Клієнт заплатив' : run.result.verdict === 'reject' ? 'Клієнт пішов' : 'Бриф закрито'}</h3>
			<div class="kpis">
				<div><span class="label">Гроші</span><span class="num big">+<Num value={run.result.paid} width={6} /> ₴</span></div>
				<div><span class="label">Репутація</span><span class="num big" class:neg={run.result.repDelta < 0}>{run.result.repDelta >= 0 ? '+' : ''}{run.result.repDelta}</span></div>
				<div><span class="label">Якість</span><span class="num big"><Num value={run.result.quality} width={3} /></span></div>
			</div>
			{#if run.result.notes.length}
				<ul class="notes">{#each run.result.notes as n}<li><span class="dot bad"></span>{n}</li>{/each}</ul>
			{:else}
				<p class="small"><span class="dot ok"></span> Перевірки пройдено: чиста робота.</p>
			{/if}
			<p class="faint small">Втома: {Object.entries(run.result.burnoutDelta).map(([r, d]) => `${ROLE_NAME[r as keyof typeof ROLE_NAME].toLowerCase()} +${d}`).join(', ')}. Щодня −6 000 ₴ на зарплати й оренду.</p>
			<button class="btn primary" onclick={onNext}>До вхідних брифів</button>
		</article>
	{:else}
		<button class="btn ghost sm drop" onclick={() => confirm(run.phase === 'failed' ? 'Закрити бриф?' : 'Кинути бриф? Репутація трохи впаде, втома лишиться.') && live.act({ action: 'drop' })}><Icon name="x" size={16} />{run.phase === 'failed' ? 'Закрити бриф' : 'Кинути бриф'}</button>
	{/if}

	<p class="faint small">{run.demo ? 'Демо: відповідає підставна модель, грошей не коштує.' : `Claude · викликів ${run.calls} · $${run.costUsd.toFixed(3)}${run.imagesUsd ? ` · картинки $${run.imagesUsd.toFixed(2)}` : ''}`}</p>
</section>

{#snippet verdict(v: ClientVerdict)}
	<article class="verdict panel rise">
		<div class="vh"><span class="dot" class:ok={v.verdict === 'ok'} class:bad={v.verdict === 'reject'} class:warn={v.verdict === 'rework'}></span>{run.brief.client.name} · {v.stage === 'core' ? 'основа' : 'канали'}, коло {v.round}</div>
		<p>«{v.reaction}»</p>
		{#each v.demands as d}<p class="small faint">— {d}</p>{/each}
	</article>
{/snippet}

<style lang="scss">
	.wrap {
		display: grid;
		gap: 10px;
	}
	.brief {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.bw {
		flex: 1;
		min-width: 0;
	}
	.client {
		font-weight: 600;
		font-size: 17px;
	}
	.biz,
	.small {
		font-size: 13px;
	}
	.quote {
		font-size: 14px;
		white-space: pre-line;
	}
	.fee {
		white-space: nowrap;
	}
	h3 {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-2);
		margin-top: 6px;
	}
	.steps {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		li {
			font-size: 12px;
			padding: 3px 8px;
			border-radius: 999px;
			border: 1px solid var(--line);
			color: var(--text-3);
			transition: all var(--t) var(--ease);
			&.done {
				color: var(--text-2);
			}
			&.now {
				border-color: var(--accent);
				color: var(--accent);
			}
			&.now.you {
				border-color: var(--human);
				color: var(--human);
			}
		}
	}
	.status {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 10px 12px;
		font-size: 14px;
		&.you {
			border-color: var(--human);
		}
	}
	.spin {
		width: 10px;
		height: 10px;
		border: 1.5px solid var(--accent);
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.err {
		color: var(--bad);
		font-size: 14px;
	}
	.pick {
		display: grid;
		gap: 8px;
	}
	.option {
		display: grid;
		gap: 2px;
		text-align: left;
		padding: 12px 14px;
		transition: border-color var(--t) var(--ease);
		&:hover:not(:disabled) {
			border-color: var(--human);
		}
	}
	.oname {
		font-weight: 600;
		font-size: 16px;
	}
	.oslogan {
		font-size: 14px;
	}
	.owhy {
		font-size: 12px;
	}
	.act {
		padding: 12px;
		display: grid;
		gap: 8px;
		position: sticky;
		bottom: calc(var(--tabs-h) + 8px + env(safe-area-inset-bottom));
		z-index: 2;
		border-color: var(--human);
	}
	@media (min-width: 860px) {
		.act {
			bottom: 8px;
		}
	}
	.row {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		flex-wrap: wrap;
	}
	.wide {
		width: 100%;
	}
	.verdict {
		padding: 12px 14px;
		display: grid;
		gap: 6px;
		border-color: color-mix(in srgb, var(--bad) 35%, var(--line));
		.vh {
			display: flex;
			gap: 8px;
			align-items: center;
			font-size: 13px;
			color: var(--text-2);
		}
	}
	.result {
		padding: 14px;
		display: grid;
		gap: 10px;
		h3 {
			color: var(--text);
			font-size: 17px;
			margin: 0;
		}
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		div {
			display: grid;
			gap: 2px;
		}
	}
	.big {
		font-size: 18px;
		&.neg {
			color: var(--bad);
		}
	}
	.notes {
		list-style: none;
		display: grid;
		gap: 4px;
		font-size: 13px;
		li {
			display: flex;
			gap: 8px;
			align-items: center;
		}
	}
	.drop {
		justify-self: start;
	}
</style>
