<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { CONTENT, CORE, TIER_NAME, type StepKey } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import ElementCard from './ElementCard.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	import Num from './Num.svelte';
	import PixelLogo from './PixelLogo.svelte';

	let { live, waiting, onOpen }: { live: Live; waiting: boolean; onOpen: () => void } = $props();
	const run = $derived(live.run!);

	/** Три великі етапи замість дрібних кроків; деталі — у «Що було». */
	const STAGES = ['Бренд-платформа', 'Комунікація', 'Оплата'];
	const stageIdx = $derived(
		run.phase === 'done' || run.phase === 'failed' ? 2 : ['content', 'images', 'player_content', 'rework_content', 'client_content', 'client_decision_content'].includes(run.phase) ? 1 : 0
	);
	const HISTORY: { key: StepKey; title: string }[] = [
		{ key: 'strategy', title: 'Стратегія: розбір і порада колег' },
		{ key: 'name', title: 'Назва й слоган: усі варіанти' },
		{ key: 'logo', title: 'Знак: усі версії' },
		{ key: 'you_core', title: 'Твої правки до платформи' },
		{ key: 'client_core', title: 'Клієнт про платформу' },
		{ key: 'content', title: 'Комунікація' },
		{ key: 'you_content', title: 'Твої правки до комунікації' },
		{ key: 'client_content', title: 'Клієнт про комунікацію' },
		{ key: 'done', title: 'Оплата' }
	];
	let history = $state(false);
	// Смужка поточного кроку: заповнюється за очікуваний час кроку, щоб було видно, що команда працює.
	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(t);
	});
	const task = $derived(run.task);
	const part = $derived(task && task.pace ? Math.min(0.95, (now - task.at) / task.pace) : 0);
	const coreIds = $derived(CORE.filter((id) => run.elements[id]));
	const contentIds = $derived(CONTENT.filter((id) => run.elements[id]));
	const busy = $derived(run.phase !== 'done' && run.phase !== 'failed' && !waiting);

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
	<p class="faint tiny">Рівень {run.brief.tier}: {TIER_NAME[run.brief.tier]} · 20% уже на рахунку, 80% — коли клієнт скаже «беру»</p>

	<ol class="stages" aria-label="Етапи брифу">
		{#each STAGES as st, i}
			<li class:done={i < stageIdx} class:now={i === stageIdx}><span class="px">{i + 1}. {st}</span></li>
		{/each}
	</ol>

	{#if task && !waiting}
		<div class="task panel" aria-live="polite">
			<div class="tl"><span>{task.label || run.status}</span><span class="faint px">крок {Math.min(task.done + 1, task.total)} з {task.total}</span></div>
			<div class="segs">{#each Array(task.total) as _, i}<i><b style:width="{i < task.done ? 100 : i === task.done ? part * 100 : 0}%"></b></i>{/each}</div>
		</div>
	{/if}
	{#if run.steps.length}<button class="btn sm ghost hist" onclick={() => (history = true)}><Icon name="eye" size={14} />Що було</button>{/if}

	<div class="status panel" class:gold={waiting} aria-live="polite">
		{#if run.paused}<Icon name="pause" size={16} />{:else if busy}<span class="spin" aria-hidden="true"></span>{/if}
		<span>{run.paused ? 'Пауза: читай спокійно' : run.status}</span>
	</div>
	{#if waiting}<button class="btn human wide" onclick={onOpen}><Icon name="play" size={16} />Твій хід</button>{/if}
	{#if run.error}<p class="err">{run.error}</p>{/if}
	{#if live.error}<p class="err">{live.error}</p>{/if}

	{#if coreIds.length}
		<h3>Бренд-платформа</h3>
		{#each coreIds as id (id)}<ElementCard el={run.elements[id]!} />{/each}
	{/if}
	{#if contentIds.length}
		<h3>Комунікація</h3>
		{#each contentIds as id (id)}<ElementCard el={run.elements[id]!} />{/each}
	{/if}

	{#if !run.result}
		<button class="btn ghost sm drop" onclick={() => confirm(run.phase === 'failed' ? 'Закрити бриф?' : 'Кинути проєкт? Клієнт нічого не заплатить, репутація трохи впаде, мораль теж.') && live.act({ action: 'drop' })}><Icon name="x" size={14} />{run.phase === 'failed' ? 'Закрити бриф' : 'Кинути проєкт'}</button>
	{/if}

	<p class="faint tiny">{run.demo ? 'Демо: відповідає підставна модель, грошей не коштує.' : `Claude · викликів ${run.calls} · $${run.costUsd.toFixed(3)}${run.imagesUsd ? ` · картинки $${run.imagesUsd.toFixed(2)}` : ''}`}</p>
</section>

{#if history}
	<Modal title="Що було" onClose={() => (history = false)}>
		{#each HISTORY as h}
			{@const rec = run.steps.find((x) => x.key === h.key)}
			{#if rec}
				<section class="rec paper">
					<h3>{h.title}</h3>
					{#if rec.logos?.length}
						<div class="logos">{#each rec.logos as l, i}<figure><PixelLogo logo={l} size={72} /><figcaption class="faint tiny">версія {i + 1}</figcaption></figure>{/each}</div>
					{/if}
					<ul>{#each rec.lines as l}<li class:chosen={l.startsWith('Обрано')}>{l}</li>{/each}</ul>
				</section>
			{/if}
		{/each}
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
	.stages {
		list-style: none;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		li {
			font-size: 13px;
			padding: 4px 6px 5px;
			text-align: center;
			border: 2px solid var(--line);
			background: #1f150f;
			color: var(--text-3);
			&.done {
				color: var(--text-2);
				border-color: var(--line-hi);
			}
			&.now {
				border-color: var(--accent);
				color: var(--accent);
			}
		}
	}
	.task {
		padding: 9px 12px 11px;
		display: grid;
		gap: 7px;
		font-size: 14px;
	}
	.tl {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		.px {
			white-space: nowrap;
			font-size: 13px;
		}
	}
	.segs {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 3px;
		padding: 2px;
		background: #120a06;
		i {
			height: 10px;
			background: #2b1c12;
			position: relative;
		}
		b {
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			background: var(--accent);
			transition: width 250ms linear;
		}
	}
	.hist {
		justify-self: start;
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
		padding: 10px 12px;
		display: grid;
		gap: 6px;
		font-size: 14px;
		h3 {
			font-size: 15px;
		}
		ul {
			list-style: none;
			display: grid;
			gap: 4px;
		}
		li.chosen {
			font-weight: 600;
		}
	}
</style>
