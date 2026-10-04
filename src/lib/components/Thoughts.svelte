<script lang="ts">
	import { ROLE_NAME, type Role, type RunState } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	/** Ланцюжок думок одного персонажа: все, що він казав і видав за цей бриф. */
	let { who, run, onClose }: { who: Role | 'client'; run: RunState | null; onClose: () => void } = $props();
	const entries = $derived((run?.log ?? []).filter((l) => l.who === who || (who !== 'client' && l.who === 'gpt' && run?.speech.find((s) => s.seq === l.seq)?.to === who)));
	const title = $derived(who === 'client' ? (run?.brief.client.name ?? 'Клієнт') : ROLE_NAME[who]);
</script>

<div class="back" onclick={onClose} role="presentation"></div>
<aside class="sheet panel rise" aria-label="Думки: {title}">
	<header>
		<Avatar {who} client={run?.brief.client} size={44} />
		<div>
			<div class="name">{title}</div>
			<div class="faint small">{who === 'client' ? run?.brief.client.archetype : run ? run.agents[who].doing : 'між брифами'}</div>
		</div>
		<button class="btn ghost sm" onclick={onClose} aria-label="Закрити"><Icon name="x" size={16} /></button>
	</header>
	{#if entries.length}
		<ol>
			{#each entries as e (e.seq)}
				<li class:gpt={e.who === 'gpt'}>
					{#if e.who === 'gpt'}<span class="faint small">Джіпітенко:</span>{/if}
					<p>{e.text}</p>
					{#if e.more?.length}<ul>{#each e.more as m}<li>{m}</li>{/each}</ul>{/if}
				</li>
			{/each}
		</ol>
	{:else}
		<p class="faint">Поки що тиша. Думки зʼявляться, коли {who === 'client' ? 'клієнт подивиться роботу' : 'візьметесь за бриф'}.</p>
	{/if}
</aside>

<style lang="scss">
	.back {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		z-index: 20;
	}
	.sheet {
		position: fixed;
		z-index: 21;
		right: 16px;
		top: calc(var(--top-h) + 12px);
		bottom: 16px;
		width: min(420px, calc(100vw - 32px));
		padding: 16px;
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 12px;
		overflow: hidden;
		background: var(--surface-1);
	}
	header {
		display: flex;
		gap: 10px;
		align-items: center;
		div {
			flex: 1;
		}
	}
	.name {
		font-weight: 600;
		font-size: 17px;
	}
	.small {
		font-size: 12px;
	}
	ol {
		list-style: none;
		overflow: auto;
		display: grid;
		gap: 10px;
		align-content: start;
		border-left: 1px solid var(--line);
		padding-left: 12px;
	}
	ol > li {
		display: grid;
		gap: 4px;
		&.gpt {
			color: var(--text-2);
		}
	}
	ul {
		list-style: none;
		display: grid;
		gap: 2px;
		font-size: 13px;
		color: var(--text-2);
	}
	@media (max-width: 859px) {
		.sheet {
			left: 12px;
			right: 12px;
			width: auto;
			top: auto;
			bottom: calc(var(--tabs-h) + 8px + env(safe-area-inset-bottom));
			max-height: 70dvh;
		}
	}
</style>
