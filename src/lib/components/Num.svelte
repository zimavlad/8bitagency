<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	/** Плавне число з резервом ширини в ch, щоб верстка не стрибала. */
	let { value, width = 6, prefix = '', suffix = '' }: { value: number; width?: number; prefix?: string; suffix?: string } = $props();
	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const t = new Tween(0, { duration: reduced ? 0 : 450, easing: cubicOut });
	$effect(() => {
		t.target = value;
	});
	const fmt = (n: number) => Math.round(n).toLocaleString('uk-UA');
</script>

<span class="num" style:min-width="{width}ch">{prefix}{fmt(t.current)}{suffix}</span>

<style>
	span {
		display: inline-block;
		text-align: right;
	}
</style>
