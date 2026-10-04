<script lang="ts">
	import '@fontsource/onest/cyrillic-400.css';
	import '@fontsource/onest/cyrillic-500.css';
	import '@fontsource/onest/cyrillic-600.css';
	import '@fontsource/onest/latin-400.css';
	import '@fontsource/onest/latin-600.css';
	import '@fontsource/jetbrains-mono/cyrillic-400.css';
	import '@fontsource/jetbrains-mono/latin-400.css';
	import '@fontsource/tiny5/cyrillic-400.css';
	import '@fontsource/tiny5/latin-400.css';
	import '@fontsource/press-start-2p/latin-400.css';
	import '$lib/styles/global.scss';
	let { children } = $props();
</script>

{@render children()}
