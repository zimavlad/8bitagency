<script lang="ts">
	import { buildSvg } from '$lib/logo';
	import { ELEMENT_OWNER, ELEMENT_TITLE, ROLE_NAME, type ElementValue } from '$lib/types';

	let { el }: { el: ElementValue } = $props();
	let showRejected = $state(false);
	// Розмітку знака будує наш код з чисел і hex після перевірки — модель туди тексту не пише.
	const svg = $derived(el.logo ? buildSvg(el.logo) : '');
</script>

<article class="card panel rise">
	<header>
		<span class="title">{ELEMENT_TITLE[el.id]}</span>
		<span class="faint owner">{ROLE_NAME[ELEMENT_OWNER[el.id]]}</span>
		{#if el.reworks}<span class="tag">перероблено ×{el.reworks}</span>{/if}
	</header>
	{#if el.image}
		<a href={el.image} target="_blank" rel="noopener"><img src={el.image} alt={ELEMENT_TITLE[el.id]} loading="lazy" /></a>
	{/if}
	{#if svg}<div class="logo">{@html svg}</div>{/if}
	<p class="main">{el.text}</p>
	{#if el.details.length}
		<ul>{#each el.details as d}<li>{d}</li>{/each}</ul>
	{/if}
	{#if el.rejected?.length}
		<button class="link faint" onclick={() => (showRejected = !showRejected)}>{showRejected ? 'сховати' : 'що відкинули'} ({el.rejected.length})</button>
		{#if showRejected}
			<ul class="rejected">{#each el.rejected as r}<li><s>{r.text}</s> <span class="faint">— {r.reason}</span></li>{/each}</ul>
		{/if}
	{/if}
</article>

<style lang="scss">
	.card {
		padding: 12px 14px;
		display: grid;
		gap: 8px;
		&:hover {
			border-color: var(--line-hi);
		}
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.title {
		font-weight: 600;
	}
	.owner {
		font-size: 12px;
	}
	.tag {
		font-size: 11px;
		padding: 1px 7px;
		border-radius: 999px;
		border: 1px solid var(--human);
		color: var(--human);
	}
	.main {
		font-size: 15px;
	}
	ul {
		list-style: none;
		display: grid;
		gap: 3px;
		font-size: 13px;
		color: var(--text-2);
	}
	.rejected {
		font-size: 12px;
	}
	img {
		width: 100%;
		border-radius: var(--r-sm);
		border: 1px solid var(--line);
		image-rendering: pixelated;
		display: block;
	}
	.logo {
		width: 84px;
		height: 84px;
		padding: 8px;
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: #fbfaf8;
		:global(svg) {
			width: 100%;
			height: 100%;
			display: block;
		}
	}
	.link {
		justify-self: start;
		font-size: 12px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
