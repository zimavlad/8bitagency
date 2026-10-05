<script lang="ts">
	/** Адмінка NotebookLM: вставити cookies з Cookie-Editor, перевірити вхід, поставити пробне питання. */
	let token = $state('');
	let cookies = $state('');
	let question = $state('Які сміливі креативні ідеї підійдуть для магазину техніки в райцентрі?');
	let owner = $state<'gpt' | 'strategist' | 'copywriter'>('gpt');
	let out = $state('');
	let busy = $state(false);

	async function call(method: 'GET' | 'POST', body?: unknown) {
		busy = true;
		out = 'Чекаю… NotebookLM може думати до хвилини.';
		try {
			const r = await fetch('/api/admin/notebooklm', { method, headers: { authorization: `Bearer ${token.trim()}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
			out = JSON.stringify(await r.json(), null, 2);
		} catch (e) {
			out = String(e);
		}
		busy = false;
	}
	function send() {
		let parsed: unknown;
		try {
			parsed = JSON.parse(cookies);
		} catch {
			out = 'Це не JSON. У Cookie-Editor натисни Export → JSON і встав сюди.';
			return;
		}
		call('POST', { cookies: parsed }).then(() => (cookies = ''));
	}
</script>

<svelte:head><title>NotebookLM: вхід</title></svelte:head>

<main>
	<h1>NotebookLM</h1>
	<label>ADMIN_TOKEN<input type="password" bind:value={token} autocomplete="off" /></label>
	<section>
		<h2>1. Вхід у Google</h2>
		<p>Відкрий notebooklm.google.com у Chrome, у розширенні Cookie-Editor натисни Export → JSON і встав сюди.</p>
		<textarea rows="6" bind:value={cookies} placeholder="[&#123;&quot;name&quot;: &quot;SID&quot;, …&#125;]"></textarea>
		<button disabled={busy || !token || !cookies} onclick={send}>Зберегти вхід</button>
	</section>
	<section>
		<h2>2. Перевірка</h2>
		<button disabled={busy || !token} onclick={() => call('GET')}>Стан</button>
		<div class="row">
			<select bind:value={owner}><option value="gpt">Джіпітенко</option><option value="strategist">Стратегиня</option><option value="copywriter">Копірайтер</option></select>
			<input bind:value={question} />
			<button disabled={busy || !token} onclick={() => call('POST', { question, owner })}>Спитати</button>
		</div>
	</section>
	{#if out}<pre>{out}</pre>{/if}
</main>

<style>
	main {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px 16px;
		display: grid;
		gap: 16px;
		color: var(--text-1);
	}
	section,
	label {
		display: grid;
		gap: 8px;
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.row input {
		flex: 1;
		min-width: 200px;
	}
	input,
	textarea,
	select {
		background: var(--surface-2);
		color: var(--text-1);
		border: 2px solid var(--line);
		padding: 8px;
		font: inherit;
	}
	button {
		justify-self: start;
		padding: 8px 14px;
		border: 2px solid var(--line-hi);
		background: var(--surface-3);
		color: var(--text-1);
	}
	pre {
		white-space: pre-wrap;
		background: var(--surface-1);
		padding: 12px;
		font-size: 13px;
	}
</style>
