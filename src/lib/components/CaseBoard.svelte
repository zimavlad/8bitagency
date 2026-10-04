<script lang="ts">
	import type { CaseData } from '$lib/types';
	import PhoneMock from './PhoneMock.svelte';
	import PixelLogo from './PixelLogo.svelte';

	/** Кейс-борд: знак, назва, слоган, позиціонування і що з цього намалював Gemini. */
	let { c, compact = false }: { c: CaseData; compact?: boolean } = $props();
</script>

<div class="board" class:compact>
	<section class="id paper">
		{#if c.logo}<PixelLogo logo={c.logo} size={96} />{/if}
		<div>
			<h3>{c.name}</h3>
			{#if c.slogan}<p class="slogan">«{c.slogan}»</p>{/if}
			{#if c.positioning}<p class="pos">{c.positioning}</p>{/if}
		</div>
	</section>
	{#if c.instagram}
		<section class="ig">
			<PhoneMock image={c.instagram.image} brand={c.name} caption={c.instagram.text} logo={c.logo} width={compact ? 170 : 210} />
		</section>
	{/if}
	{#if c.youtube}
		<section class="yt paper">
			<h4>YouTube: {c.youtube.text}</h4>
			{#if c.youtube.image}<img src={c.youtube.image} alt="Розкадровка ролика" />{/if}
			<ol>{#each c.youtube.scenes as sc, i}<li><span class="n px">{i + 1}</span>{sc}</li>{/each}</ol>
		</section>
	{/if}
	{#if c.threads?.length}
		<section class="th paper">
			<h4>Threads</h4>
			{#each c.threads as t, i}<p class:voice={i === 0}>{t}</p>{/each}
		</section>
	{/if}
</div>

<style lang="scss">
	.board {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 10px;
		align-items: start;
	}
	.id {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 12px;
		align-items: center;
		padding: 10px 12px;
		h3 {
			font-size: 24px;
		}
	}
	.slogan {
		font-size: 16px;
		font-weight: 500;
	}
	.pos {
		font-size: 13px;
		color: #6d5236;
	}
	.ig {
		grid-column: 2;
		grid-row: 2 / span 2;
	}
	.yt,
	.th {
		grid-column: 1;
		padding: 10px 12px;
		display: grid;
		gap: 6px;
		h4 {
			font-size: 14px;
		}
	}
	.yt {
		img {
			width: 100%;
			display: block;
			image-rendering: pixelated;
			border: 2px solid #3a2414;
		}
		ol {
			list-style: none;
			display: grid;
			gap: 3px;
			font-size: 13px;
		}
		li {
			display: flex;
			gap: 6px;
		}
		.n {
			flex: 0 0 18px;
			height: 18px;
			display: grid;
			place-items: center;
			background: #3a2414;
			color: var(--paper);
			font-size: 12px;
		}
	}
	.th {
		p {
			font-size: 13px;
		}
		.voice {
			color: #6d5236;
		}
	}
	.compact {
		grid-template-columns: 1fr;
		.ig {
			grid-column: 1;
			grid-row: auto;
			justify-self: center;
		}
		.id h3 {
			font-size: 18px;
		}
	}
	@media (max-width: 560px) {
		.board {
			grid-template-columns: 1fr;
		}
		.ig {
			grid-column: 1;
			grid-row: auto;
			justify-self: center;
		}
	}
</style>
