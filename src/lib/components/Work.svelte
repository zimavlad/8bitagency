<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { CONTENT, CORE, ROLE_NAME, type ElementId, type RunPhase } from '$lib/types';
	import ElementCard from './ElementCard.svelte';
	import Icon from './Icon.svelte';
	import Num from './Num.svelte';

	let { live, onNext }: { live: Live; onNext: () => void } = $props();
	const run = $derived(live.run!);

	const STEPS: { label: string; phases: RunPhase[] }[] = [
		{ label: 'Читання', phases: ['read'] },
		{ label: 'Суперечка', phases: ['review'] },
		{ label: 'Основа', phases: ['core'] },
		{ label: 'Ти', phases: ['player_core'] },
		{ label: 'Клієнт', phases: ['client_core', 'rework_core'] },
		{ label: 'Контент', phases: ['content'] },
		{ label: 'Ти', phases: ['player_content'] },
		{ label: 'Клієнт', phases: ['client_content', 'rework_content'] },
		{ label: 'Оплата', phases: ['done'] }
	];
	const stepIdx = $derived(STEPS.findIndex((s) => s.phases.includes(run.phase)));
	const playerTurn = $derived(run.phase === 'player_core' || run.phase === 'player_content');
	const coreIds = $derived(CORE.filter((id) => run.elements[id]));
	const contentIds = $derived(CONTENT.filter((id) => run.elements[id]));
	const editable = (id: ElementId) => (run.phase === 'player_core' && CORE.includes(id as never)) || (run.phase === 'player_content' && CONTENT.includes(id as never));
	let showLog = $state(false);
	const whoName = (w: string) => (w === 'system' ? '' : w === 'gpt' ? 'Джіпітенко' : w === 'client' ? run.brief.client.name : ROLE_NAME[w as keyof typeof ROLE_NAME]);
</script>

<section class="wrap">
	<header class="brief">
		<div>
			<div class="client">{run.brief.client.name}</div>
			<div class="faint biz">{run.brief.client.business}</div>
		</div>
		<div class="fee"><Num value={run.brief.fee} width={7} suffix=" ₴" /></div>
	</header>
	<p class="muted quote">«{run.brief.text}»</p>

	<ol class="steps" aria-label="Етапи брифу">
		{#each STEPS as s, i}
			<li class:done={i < stepIdx} class:now={i === stepIdx} class:you={s.label === 'Ти'}>{s.label}</li>
		{/each}
	</ol>

	<div class="status panel" aria-live="polite">
		{#if run.phase !== 'done' && run.phase !== 'failed' && !playerTurn}<span class="spin"></span>{/if}
		<span>{run.status}</span>
	</div>
	{#if run.error}<p class="err">{run.error}</p>{/if}
	{#if live.error}<p class="err">{live.error}</p>{/if}

	{#if coreIds.length}
		<h3>Основа бренду</h3>
		{#each coreIds as id (id)}
			<ElementCard el={run.elements[id]!} editable={editable(id)} canEdit={editable(id) && live.editsLeft.includes(id)} onEdit={(c) => live.act({ action: 'edit', element: id, comment: c })} onApprove={() => live.act({ action: 'approve', element: id })} />
		{/each}
	{/if}

	{#each run.verdicts.filter((v) => v.stage === 'core') as v}
		<article class="verdict panel rise" class:ok={v.verdict === 'ok'} class:bad={v.verdict === 'reject'}>
			<div class="vh"><span class="dot" class:ok={v.verdict === 'ok'} class:bad={v.verdict === 'reject'} class:warn={v.verdict === 'rework'}></span>{run.brief.client.name} · {v.round === 1 ? 'перша подивка' : 'після правок'}</div>
			<p>«{v.reaction}»</p>
			{#each v.demands as d}<p class="small faint">вимагає: {d.demand}</p>{/each}
		</article>
	{/each}

	{#if contentIds.length}
		<h3>Контент</h3>
		{#each contentIds as id (id)}
			<ElementCard el={run.elements[id]!} editable={editable(id)} canEdit={editable(id) && live.editsLeft.includes(id)} onEdit={(c) => live.act({ action: 'edit', element: id, comment: c })} onApprove={() => live.act({ action: 'approve', element: id })} />
		{/each}
	{/if}

	{#each run.verdicts.filter((v) => v.stage === 'content') as v}
		<article class="verdict panel rise">
			<div class="vh"><span class="dot" class:ok={v.verdict === 'ok'} class:bad={v.verdict === 'reject'} class:warn={v.verdict === 'rework'}></span>{run.brief.client.name} · {v.round === 1 ? 'дивиться контент' : 'після правок'}</div>
			<p>«{v.reaction}»</p>
			{#each v.demands as d}<p class="small faint">вимагає: {d.demand}</p>{/each}
		</article>
	{/each}

	{#if playerTurn}
		<div class="sticky">
			<button class="btn primary wide" disabled={live.busy} onclick={() => live.act({ action: 'submit' })}><Icon name="send" size={16} />Показати клієнту</button>
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

	<button class="link faint" onclick={() => (showLog = !showLog)}>{showLog ? 'Сховати' : 'Показати'} стенограму ({run.log.length})</button>
	{#if showLog}
		<ol class="log">
			{#each [...run.log].reverse() as l (l.seq)}
				<li><b>{whoName(l.who)}</b> {l.text}</li>
			{/each}
		</ol>
	{/if}
	<p class="faint small">{run.demo ? 'Демо: відповідає підставна модель, грошей не коштує.' : `Claude · викликів ${run.calls} · $${run.costUsd.toFixed(3)}`}</p>
</section>

<style lang="scss">
	.wrap {
		display: grid;
		gap: 10px;
	}
	.brief {
		display: flex;
		justify-content: space-between;
		gap: 10px;
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
	.sticky {
		position: sticky;
		/* на телефоні — над нижніми табами */
		bottom: calc(var(--tabs-h) + 8px + env(safe-area-inset-bottom));
		padding-top: 4px;
		z-index: 2;
	}
	@media (min-width: 860px) {
		.sticky {
			bottom: 8px;
		}
	}
	.wide {
		width: 100%;
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
	.link {
		justify-self: start;
		font-size: 12px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.log {
		list-style: none;
		display: grid;
		gap: 6px;
		font-size: 13px;
		color: var(--text-2);
		max-height: 320px;
		overflow: auto;
		border-left: 1px solid var(--line);
		padding-left: 10px;
		b {
			color: var(--text);
			font-weight: 600;
		}
	}
</style>
