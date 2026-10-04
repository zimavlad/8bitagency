<script lang="ts">
	import { logoPixels } from '$lib/pixels';
	import type { LogoSpec } from '$lib/types';

	/** Знак у стилі гри: справжні 32×32 пікселі, збільшені без згладжування. */
	let { logo, size = 96, grid = 32 }: { logo: LogoSpec; size?: number; grid?: number } = $props();
	let cv: HTMLCanvasElement;

	$effect(() => {
		const px = logoPixels(logo, grid);
		const ctx = cv.getContext('2d')!;
		ctx.clearRect(0, 0, grid, grid);
		if (px) ctx.putImageData(new ImageData(new Uint8ClampedArray(px), grid, grid), 0, 0);
	});
</script>

<canvas bind:this={cv} width={grid} height={grid} style:width="{size}px" style:height="{size}px" aria-label="Знак"></canvas>

<style>
	canvas {
		image-rendering: pixelated;
		display: block;
		border: 2px solid #120a06;
		flex: 0 0 auto;
	}
</style>
