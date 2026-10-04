<script lang="ts">
	import type { LogoSpec } from '$lib/types';
	import PixelLogo from './PixelLogo.svelte';

	/** Банер, «намакаплений» у піксельний iPhone 5s зі стрічкою Instagram. */
	let { image, brand, caption, logo, width = 220 }: { image?: string; brand: string; caption: string; logo?: LogoSpec; width?: number } = $props();
	const handle = $derived(brand.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/giu, '_').replace(/^_|_$/g, '').slice(0, 18) || 'brand');
</script>

<figure class="phone" style:width="{width}px">
	<span class="speaker" aria-hidden="true"></span>
	<div class="screen">
		<div class="bar px"><span>9:41</span><span>Instagram</span><span>▮▮▮</span></div>
		<div class="head">
			{#if logo}<PixelLogo {logo} size={18} grid={16} />{:else}<span class="ava"></span>{/if}
			<span class="px handle">{handle}</span>
			<span class="sp">Реклама</span>
		</div>
		{#if image}<img src={image} alt="Банер {brand}" />{:else}<div class="ph px">банер ще малюється</div>{/if}
		<div class="icons" aria-hidden="true"><i class="heart"></i><i class="bubble"></i><i class="send"></i></div>
		<p class="likes px">1 024 вподобання</p>
		<p class="cap"><b>{handle}</b> {caption}</p>
	</div>
	<span class="home" aria-hidden="true"></span>
</figure>

<style lang="scss">
	.phone {
		position: relative;
		margin: 0;
		padding: 34px 9px 40px;
		background: #1c1d21;
		border: 3px solid #0c0d10;
		outline: 2px solid #9aa1ae;
		outline-offset: -5px;
		clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
		flex: 0 0 auto;
	}
	.speaker {
		position: absolute;
		top: 15px;
		left: 50%;
		width: 34px;
		height: 4px;
		transform: translateX(-50%);
		background: #3a3d44;
	}
	.home {
		position: absolute;
		bottom: 9px;
		left: 50%;
		width: 22px;
		height: 22px;
		transform: translateX(-50%);
		border: 3px solid #3a3d44;
		clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
	}
	.screen {
		min-width: 0;
		overflow: hidden;
		grid-template-columns: minmax(0, 1fr);
		background: #fafafa;
		color: #111;
		display: grid;
		gap: 4px;
		padding-bottom: 6px;
		font-size: 11px;
		line-height: 1.3;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		padding: 3px 6px;
		font-size: 10px;
		border-bottom: 1px solid #ddd;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 6px;
		font-size: 11px;
		.handle {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.sp {
			margin-left: auto;
			color: #888;
			font-size: 10px;
		}
		:global(canvas) {
			border-width: 1px;
		}
	}
	.ava {
		width: 18px;
		height: 18px;
		background: #ccc;
	}
	img,
	.ph {
		width: 100%;
		aspect-ratio: 1;
		display: block;
		image-rendering: pixelated;
		object-fit: cover;
	}
	.ph {
		display: grid;
		place-items: center;
		background: #e8e8e8;
		color: #888;
	}
	.icons {
		display: flex;
		gap: 8px;
		padding: 0 6px;
		i {
			width: 12px;
			height: 11px;
			display: block;
			background: #111;
		}
		.heart {
			clip-path: polygon(50% 100%, 0 40%, 0 15%, 20% 0, 50% 20%, 80% 0, 100% 15%, 100% 40%);
			background: #e0245e;
		}
		.bubble {
			clip-path: polygon(0 0, 100% 0, 100% 75%, 35% 75%, 10% 100%, 15% 75%, 0 75%);
		}
		.send {
			clip-path: polygon(0 0, 100% 50%, 0 100%, 15% 50%);
		}
	}
	.likes {
		padding: 0 6px;
		font-size: 10px;
	}
	.cap {
		padding: 0 6px;
		overflow-wrap: anywhere;
		b {
			font-weight: 600;
		}
	}
</style>
