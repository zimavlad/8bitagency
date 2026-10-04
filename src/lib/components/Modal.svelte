<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	/** Ігрове вікно поверх офісу. onClose — хрестик/тло/Esc; без нього вікно чекає рішення. */
	let { title, onClose, closeLabel = 'Закрити', wide = false, children, head }: { title: string; onClose?: () => void; closeLabel?: string; wide?: boolean; children: Snippet; head?: Snippet } = $props();
</script>

<div class="back" role="presentation" onclick={() => onClose?.()}></div>
<div class="modal panel pop" class:wide role="dialog" aria-modal="true" aria-label={title}>
	<header>
		{#if head}{@render head()}{/if}
		<h2>{title}</h2>
		{#if onClose}<button class="btn ghost sm x" onclick={onClose} aria-label={closeLabel} title={closeLabel}><Icon name="x" size={16} /></button>{/if}
	</header>
	<div class="body">{@render children()}</div>
</div>

<style lang="scss">
	.back {
		position: fixed;
		inset: 0;
		background: rgba(8, 9, 12, 0.55);
		z-index: 30;
	}
	.modal {
		position: fixed;
		z-index: 31;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(480px, calc(100vw - 24px));
		max-height: calc(100dvh - 32px);
		display: grid;
		grid-template-rows: auto 1fr;
		padding: 14px 16px 16px;
		gap: 12px;
		&.wide {
			width: min(1000px, calc(100vw - 24px));
		}
	}
	.pop {
		animation: none;
	}
	header {
		display: flex;
		align-items: center;
		gap: 10px;
		h2 {
			flex: 1;
			font-size: 20px;
			line-height: 1.2;
		}
	}
	.x {
		padding: 0 8px 2px;
	}
	.body {
		overflow: auto;
		display: grid;
		gap: 12px;
		align-content: start;
		min-height: 0;
	}
</style>
