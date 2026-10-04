<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Лист у грі: від кого, кому, тема, текст. Кнопки — знизу (закрити або відповісти). */
	let { from, to, subject, body, ps, children }: { from: string; to: string; subject: string; body: string[]; ps?: string; children: Snippet } = $props();
</script>

<div class="back" role="presentation"></div>
<div class="mail paper pop" role="dialog" aria-modal="true" aria-label={subject}>
	<dl class="head">
		<dt>Від</dt><dd>{from}</dd>
		<dt>Кому</dt><dd>{to}</dd>
		<dt>Тема</dt><dd class="subj">{subject}</dd>
	</dl>
	<div class="text">
		{#each body as p}<p>{p}</p>{/each}
		{#if ps}<p class="ps">P. S. {ps}</p>{/if}
	</div>
	<div class="acts">{@render children()}</div>
</div>

<style lang="scss">
	.back {
		position: fixed;
		inset: 0;
		background: rgba(10, 6, 4, 0.7);
		z-index: 50;
	}
	.mail {
		position: fixed;
		z-index: 51;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(500px, calc(100vw - 24px));
		max-height: calc(100dvh - 32px);
		overflow: auto;
		padding: 16px 18px;
		display: grid;
		gap: 12px;
	}
	.pop {
		animation: none;
	}
	.head {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 2px 12px;
		font-size: 14px;
		padding-bottom: 10px;
		border-bottom: 2px dashed #d8c096;
		dt {
			font-family: var(--pixel);
			color: #94785a;
		}
		dd {
			overflow-wrap: anywhere;
		}
	}
	.subj {
		font-weight: 600;
	}
	.text {
		display: grid;
		gap: 8px;
		font-size: 15px;
		line-height: 1.5;
	}
	.ps {
		color: #6d5236;
	}
	.acts {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		flex-wrap: wrap;
	}
</style>
