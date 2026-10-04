<script lang="ts">
	import { BODY, PALETTE, clientSprite } from '$lib/scene/sprites';
	import type { Client, Role } from '$lib/types';

	/** Портрет з того самого спрайта, що в офісі: голова й плечі, з обводкою. */
	let { who, client, size = 40 }: { who: Role | 'client'; client?: Client; size?: number } = $props();
	let cv: HTMLCanvasElement;

	$effect(() => {
		const cs = who === 'client' && client ? clientSprite(client.gender, client.look) : null;
		const rows = (cs ? cs.body : BODY[who === 'client' ? 'client' : who]).slice(0, 18);
		const pal: Record<string, string> = cs ? cs.pal : PALETTE[who === 'client' ? 'client' : who];
		const ctx = cv.getContext('2d')!;
		ctx.clearRect(0, 0, 20, 20);
		const filled = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < 16 && rows[y][x] !== '.';
		ctx.fillStyle = pal.outline;
		for (let y = -1; y <= rows.length; y++) for (let x = -1; x <= 16; x++) if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) ctx.fillRect(x + 2, y + 1, 1, 1);
		rows.forEach((r, y) => { for (let x = 0; x < 16; x++) { const c = pal[r[x]]; if (r[x] !== '.' && c) { ctx.fillStyle = c; ctx.fillRect(x + 2, y + 1, 1, 1); } } });
	});
</script>

<canvas bind:this={cv} width="20" height="20" style:width="{size}px" style:height="{size}px" aria-hidden="true"></canvas>

<style>
	canvas {
		image-rendering: pixelated;
		background: var(--surface-3);
		border: 2px solid #120a06;
		flex: 0 0 auto;
	}
</style>
