<script lang="ts">
	/** Власні svg-іконки 20×20, штрих 1.6. Emoji як іконки не вживаємо. */
	type Name = 'inbox' | 'work' | 'team' | 'sun' | 'moon' | 'coffee' | 'x' | 'check' | 'edit' | 'send' | 'coin' | 'star' | 'flame' | 'bot' | 'plus' | 'reset' | 'pause' | 'play' | 'door';
	let { name, size = 18 }: { name: Name; size?: number } = $props();
	const P: Record<Name, string> = {
		inbox: 'M3 11h4l1.5 2.5h3L13 11h4M3 11l2-6h10l2 6v5H3z',
		work: 'M7 6V4.5h6V6M3 6h14v10H3zM3 10.5h14',
		team: 'M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2.5 16c.5-2.6 2.2-4 4.5-4s4 1.4 4.5 4M13.5 9a2 2 0 1 0 0-4M14.5 12c1.7.3 2.7 1.6 3 4',
		sun: 'M10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM10 1.8v1.8M10 16.4v1.8M1.8 10h1.8M16.4 10h1.8M4.2 4.2l1.3 1.3M14.5 14.5l1.3 1.3M4.2 15.8l1.3-1.3M14.5 5.5l1.3-1.3',
		moon: 'M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7z',
		coffee: 'M4 7h10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM14 8.5h1.5a2 2 0 0 1 0 4H14M7 2.5v2M10 2.5v2',
		x: 'M5 5l10 10M15 5L5 15',
		check: 'M4 10.5l4 4 8-9',
		edit: 'M12.5 4l3.5 3.5L7.5 16H4v-3.5zM10.5 6l3.5 3.5',
		send: 'M3 10l14-6-5 13-2.5-5.5z',
		coin: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12.5 7.5c-.5-.7-1.4-1-2.5-1-1.5 0-2.5.7-2.5 1.7 0 2.6 5 1.2 5 3.8 0 1-1 1.8-2.5 1.8-1.2 0-2.1-.4-2.6-1.1M10 5v1.5M10 13.5V15',
		star: 'M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z',
		flame: 'M10 17.5c3 0 5-2 5-4.8 0-3.2-2.6-4.6-3.4-8.2-1.8 1.4-2.6 3.2-2.6 4.8-.9-.7-1.5-1.7-1.7-2.8C5.8 8 5 9.8 5 12.7c0 2.8 2 4.8 5 4.8z',
		bot: 'M4 7h12v8H4zM10 4v3M7.5 11h.01M12.5 11h.01M8 13.5h4M2 10v3M18 10v3',
		plus: 'M10 4v12M4 10h12',
		reset: 'M4 10a6 6 0 1 0 1.8-4.3M4 3.5v3h3',
		pause: 'M7 4.5v11M13 4.5v11',
		play: 'M6.5 4.5l9 5.5-9 5.5z',
		door: 'M5 17V3h9v14M3 17h14M11 10.5h.01'
	};
</script>

<svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={P[name]} /></svg>
