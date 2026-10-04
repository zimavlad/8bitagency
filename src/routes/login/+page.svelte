<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Вхід · 8bitagency</title></svelte:head>

<main>
	<form method="POST" class="panel">
		<input type="password" name="password" placeholder="Пароль" autocomplete="current-password" aria-label="Пароль" required />
		<button class="btn primary">Увійти</button>
		{#if form?.wrong}<p>Не той пароль.</p>{/if}
	</form>
</main>

<style>
	main {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 16px;
	}
	form {
		width: min(320px, 100%);
		padding: 20px;
		display: grid;
		gap: 10px;
	}
	input {
		width: 100%;
		background: var(--surface-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		padding: 10px 12px;
	}
	p {
		color: var(--bad);
		font-size: 14px;
	}
</style>
