<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { CONTENT, CORE, TIER_NAME, type RunPhase, type StepKey } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import ElementCard from './ElementCard.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	import Num from './Num.svelte';
	import PixelLogo from './PixelLogo.svelte';

	let { live, waiting, onOpen }: { live: Live; waiting: boolean; onOpen: () => void } = $props();
	const run = $derived(live.run!);

	const STEPS: { label: string; title: string; key: StepKey; phases: RunPhase[]; you?: boolean }[] = [
		{ label: 'Стратегія', title: 'Стратегія: розбір і порада колег', key: 'strategy', phases: ['read', 'huddle', 'position'] },
		{ label: 'Назва', title: 'Назва: усі варіанти', key: 'name', phases: ['naming', 'pick_name'] },
		{ label: 'Лого', title: 'Лого: усі версії', key: 'logo', phases: ['logo'] },
		{ label: 'Ти', title: 'Твої правки до основи', key: 'you_core', phases: ['player_core', 'rework_core'], you: true },
		{ label: 'Клієнт', title: 'Клієнт про основу', key: 'client_core', phases: ['client_core', 'client_decision_core'] },
		{ label: 'Канали', title: 'Канали', key: 'content', phases: ['content', 'images'] },
		{ label: 'Ти', title: 'Твої правки до каналів', key: 'you_content', phases: ['player_content', 'rework_content'], you: true },
		{ label: 'Клієнт', title: 'Клієнт про канали', key: 'client_content', phases: ['client_content', 'client_decision_content'] },
		{ label: 'Оплата', title: 'Оплата', key: 'done', phases: ['done'] }
	];
	const stepIdx = $derived(STEPS.findIndex((s) => s.phases.includes(run.phase)));
	const coreIds = $derived(CORE.filter((id) => run.elements[id]));
	const contentIds = $derived(CONTENT.filter((id) => run.elements[id]));
	const busy = $derived(run.phase !== 'done' && run.phase !== 'failed' && !waiting);
	let view = $state<StepKey | null>(null);
	const rec = $derived(view ? run.steps.find((s) => s.key === view) : undefined);
</script>

<section class="wrap">
	<header class="brief">
		<Avatar who="client" client={run.brief.client} size={44} />
		<div class="bw">
			<div class="client">{run.brief.client.name}</div>
			<div class="faint biz">{run.brief.client.business}</div>
		</div>
		<div class="fee">
			<span class="num"><Num value={run.brief.fee} width={6} suffix=" ₴" /></span>
			<span class="faint tiny">передплата {run.brief.prepay} ₴</span>
		</div>
	</header>
	<p class="muted quote">«{run.brief.text}»</p>
	<p class="faint tiny">Рівень {run.brief.tier}: {TIER_NAME[run.brief.tier]} · 60% чеку за основу, 40% за канали</p>

	<ol class="steps" aria-label="Етапи брифу">
		{#each STEPS as s, i}
			{@const has = run.steps.some((r) => r.key === s.key)}
			<li>
				<button class:done={i < stepIdx} class:now={i === stepIdx} class:you={s.you} disabled={!has} title={has ? 'Переглянути, що було' : ''} onclick={() => (view = s.key)}>{s.label}</button>
			</li>
		{/each}
	</ol>

	<div class="status panel" class:gold={waiting} aria-live="polite">
		{#if run.paused}<Icon name="pause" size={16} />{:else if busy}<span class="spin" aria-hidden="true"></span>{/if}
		<span>{run.paused ? 'Пауза: читай спокійно' : run.status}</span>
	</div>
	{#if waiting}<button class="btn human wide" onclick={onOpen}><Icon name="play" size={16} />Твій хід</button>{/if}
	{#if run.error}<p class="err">{run.error}</p>{/if}
	{#if live.error}<p class="err">{live.error}</p>{/if}

	{#if coreIds.length}
		<h3>Основа бренду</h3>
		{#each coreIds as id (id)}<ElementCard el={run.elements[id]!} />{/each}
	{/if}
	{#if contentIds.length}
		<h3>Канали</h3>
		{#each contentIds as id (id)}<ElementCard el={run.elements[id]!} />{/each}
	{/if}

	{#if !run.result}
		<button class="btn ghost sm drop" onclick={() => confirm(run.phase === 'failed' ? 'Закрити бриф?' : 'Кинути проєкт? Клієнт нічого не заплатить, репутація трохи впаде, мораль теж.') && live.act({ action: 'drop' })}><Icon name="x" size={14} />{run.phase === 'failed' ? 'Закрити бриф' : 'Кинути проєкт'}</button>
	{/if}

	<p class="faint tiny">{run.demo ? 'Демо: відповідає підставна модель, грошей не коштує.' : `Claude · викликів ${run.calls} · $${run.costUsd.toFixed(3)}${run.imagesUsd ? ` · картинки $${run.imagesUsd.toFixed(2)}` : ''}`}</p>
</section>

{#if view && rec}
	<Modal title={STEPS.find((s) => s.key === view)!.title} onClose={() => (view = null)}>
		{#if rec.logos?.length}
			<div class="logos">{#each rec.logos as l, i}<figure><PixelLogo logo={l} size={88} /><figcaption class="faint tiny">версія {i + 1}</figcaption></figure>{/each}</div>
		{/if}
		<ul class="rec paper">{#each rec.lines as l}<li class:chosen={l.startsWith('Обрано')}>{l}</li>{/each}</ul>
	</Modal>
{/if}

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
		font-family: var(--pixel);
		font-weight: 600;
		font-size: 18px;
	}
	.biz {
		font-size: 13px;
	}
	.tiny {
		font-size: 12px;
	}
	.quote {
		font-size: 14px;
		white-space: pre-line;
	}
	.fee {
		white-space: nowrap;
		display: grid;
		justify-items: end;
		font-family: var(--pixel);
		font-size: 17px;
	}
	h3 {
		font-size: 15px;
		color: var(--text-2);
		margin-top: 6px;
	}
	.steps {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		button {
			font-family: var(--pixel);
			font-size: 13px;
			padding: 2px 8px 3px;
			border: 2px solid var(--line);
			background: #1f150f;
			color: var(--text-3);
			&.done {
				color: var(--text-2);
				border-color: var(--line-hi);
			}
			&:not(:disabled):hover {
				color: var(--text);
			}
			&:disabled {
				cursor: default;
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
		padding: 9px 12px;
		font-size: 14px;
	}
	.spin {
		width: 10px;
		height: 10px;
		background: var(--accent);
		animation: blink 0.8s steps(2) infinite;
	}
	@keyframes blink {
		50% {
			opacity: 0.2;
		}
	}
	.err {
		color: var(--bad);
		font-size: 14px;
	}
	.drop {
		justify-self: start;
	}
	.logos {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		figure {
			display: grid;
			gap: 2px;
			justify-items: center;
		}
	}
	.rec {
		list-style: none;
		padding: 10px 12px;
		display: grid;
		gap: 6px;
		font-size: 14px;
		li.chosen {
			font-weight: 600;
		}
	}
</style>
