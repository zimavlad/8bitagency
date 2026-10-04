<script lang="ts">
	import { ELEMENT_OWNER, ELEMENT_TITLE, ROLE_NAME, type ElementValue } from '$lib/types';
	import PhoneMock from './PhoneMock.svelte';
	import ThreadsMock from './ThreadsMock.svelte';
	import PixelLogo from './PixelLogo.svelte';

	let { el, brand = '' }: { el: ElementValue; brand?: string } = $props();
	let showRejected = $state(false);
</script>

<article class="card panel rise">
	<header>
		<span class="title">{ELEMENT_TITLE[el.id]}</span>
		<span class="faint owner">{ROLE_NAME[ELEMENT_OWNER[el.id]]}</span>
		{#if el.reworks}<span class="tag">перероблено ×{el.reworks}</span>{/if}
	</header>
	{#if el.id === 'instagram'}
		<div class="pm"><PhoneMock image={el.image} {brand} caption={el.text} width={190} /></div>
	{:else if el.image}
		<a href={el.image} target="_blank" rel="noopener"><img src={el.image} alt={ELEMENT_TITLE[el.id]} loading="lazy" /></a>
	{/if}
	{#if el.logo}<PixelLogo logo={el.logo} size={88} />{/if}
	<p class="main">{el.text}</p>
	{#if el.why && el.id !== 'slogan'}<p class="why">Чому: {el.why}</p>{/if}
	{#if el.id === 'threads'}
		<ThreadsMock posts={el.details} {brand} />
	{:else if el.details.length}
		<ul class:num={el.id === 'youtube'}>{#each el.details as d, i}<li>{#if el.id === 'youtube'}<span class="n px">{i + 1}</span>{/if}{d}</li>{/each}</ul>
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
		padding: 10px 12px;
		display: grid;
		gap: 6px;
	}
	.pm {
		display: grid;
		justify-items: center;
	}
	.num li {
		display: flex;
		gap: 6px;
	}
	.n {
		flex: 0 0 18px;
		height: 18px;
		display: grid;
		place-items: center;
		background: var(--surface-3);
		color: var(--text);
		font-size: 12px;
	}
	.why {
		font-size: 13px;
		color: var(--text-2);
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.title {
		font-family: var(--pixel);
		font-weight: 600;
	}
	.owner {
		font-size: 12px;
	}
	.tag {
		font-size: 11px;
		padding: 1px 7px;
		font-family: var(--pixel);
		border: 2px solid var(--human);
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
		border: 2px solid #0c0d10;
		image-rendering: pixelated;
		display: block;
	}
	.link {
		justify-self: start;
		font-size: 12px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
