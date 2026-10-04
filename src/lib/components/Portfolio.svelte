<script lang="ts">
	import type { HistoryEntry } from '$lib/types';
	import CaseBoard from './CaseBoard.svelte';
	import Modal from './Modal.svelte';
	import PixelLogo from './PixelLogo.svelte';

	/** Зроблені роботи: клік — кейс-борд проєкту. */
	let { items }: { items: HistoryEntry[] } = $props();
	let open = $state<HistoryEntry | null>(null);
</script>

<section class="pf">
	<h3>Зроблені роботи</h3>
	{#each items as h}
		<button class="item panel" disabled={!h.case} onclick={() => (open = h)}>
			{#if h.case?.logo}<PixelLogo logo={h.case.logo} size={36} />{:else}<span class="nologo"></span>{/if}
			<span class="t">
				<span class="nm px">{h.name}</span>
				<span class="faint small">{h.client} · {h.business}</span>
			</span>
			<span class="num" class:bad={h.verdict !== 'ok'}>+{h.paid.toLocaleString('uk-UA')} ₴</span>
		</button>
	{:else}
		<p class="faint small">Поки порожньо. Перший кейс буде після першого брифу.</p>
	{/each}
</section>

{#if open?.case}
	<Modal title="Кейс: {open.case.name}" wide onClose={() => (open = null)}>
		<p class="faint small">{open.client} · {open.business} · день {open.day}</p>
		<CaseBoard c={open.case} />
	</Modal>
{/if}

<style lang="scss">
	.pf {
		display: grid;
		gap: 6px;
		margin-top: 10px;
		h3 {
			font-size: 15px;
			color: var(--text-2);
		}
	}
	.item {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 8px 10px;
		text-align: left;
		&:disabled {
			cursor: default;
			opacity: 0.7;
		}
	}
	.nologo {
		width: 36px;
		height: 36px;
		background: var(--surface-3);
		flex: 0 0 auto;
	}
	.t {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.nm {
		font-size: 15px;
	}
	.small {
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bad {
		color: var(--text-3);
	}
</style>
