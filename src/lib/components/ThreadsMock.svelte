<script lang="ts">
	import type { LogoSpec } from '$lib/types';
	import PixelLogo from './PixelLogo.svelte';

	/** Пости як у стрічці Threads: ава, нік, текст, лічильники. */
	let { posts, brand, logo }: { posts: string[]; brand: string; logo?: LogoSpec } = $props();
	const handle = $derived(brand.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/giu, '_').replace(/^_|_$/g, '').slice(0, 18) || 'brand');
</script>

<div class="feed">
	{#each posts as p, i}
		<article class="post">
			{#if logo}<PixelLogo {logo} size={26} grid={16} />{:else}<span class="ava"></span>{/if}
			<div class="body">
				<div class="top"><b class="px">{handle}</b><span class="t">{[2, 5, 9][i] ?? 1} год</span></div>
				<p>{p}</p>
				<div class="meta px"><span>♡ {[48, 213, 17][i] ?? 7}</span><span>💬 {[6, 31, 2][i] ?? 1}</span></div>
			</div>
		</article>
	{/each}
</div>

<style lang="scss">
	.feed {
		background: #101114;
		border: 2px solid #0c0d10;
		display: grid;
	}
	.post {
		display: flex;
		gap: 8px;
		padding: 8px 10px;
		border-bottom: 1px solid #26282e;
		color: #f1f1f1;
		&:last-child {
			border-bottom: none;
		}
		:global(canvas) {
			border-width: 1px;
		}
	}
	.ava {
		width: 26px;
		height: 26px;
		background: #444;
		flex: 0 0 auto;
	}
	.body {
		min-width: 0;
		display: grid;
		gap: 2px;
	}
	.top {
		display: flex;
		gap: 6px;
		align-items: baseline;
		font-size: 12px;
		b {
			font-weight: 400;
		}
		.t {
			color: #8a8d96;
			font-size: 11px;
		}
	}
	p {
		font-size: 13px;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.meta {
		display: flex;
		gap: 12px;
		font-size: 11px;
		color: #8a8d96;
	}
</style>
