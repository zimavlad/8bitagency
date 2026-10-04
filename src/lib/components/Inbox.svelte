<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import Num from './Num.svelte';

	let { live }: { live: Live } = $props();
	let custom = $state(false);
	const empty = () => ({ business: '', goals: '', wishes: '', competitors: '', usp: '' });
	let form = $state(empty());
	const FIELDS: { key: keyof ReturnType<typeof empty>; label: string; hint: string }[] = [
		{ key: 'business', label: 'Що за бізнес', hint: 'Кавʼярня на Подолі, своя обсмажка' },
		{ key: 'goals', label: 'Цілі', hint: 'Більше гостей зранку, впізнаваність у районі' },
		{ key: 'wishes', label: 'Побажання', hint: 'Затишно, без пафосу, щоб студенти теж заходили' },
		{ key: 'competitors', label: 'Конкуренти', hint: 'Aroma, One Love, кавові кіоски біля метро' },
		{ key: 'usp', label: 'УТП', hint: 'Що у вас є, чого нема в інших' }
	];
	const g = $derived(live.game!);
	const locked = $derived(!!g.activeRun || g.bankrupt);
</script>

<section class="wrap">
	<div class="head">
		<h2>Вхідні брифи</h2>
		<span class="faint">день <span class="num">{g.day}</span></span>
	</div>
	{#if locked && g.activeRun}
		<p class="muted">Команда зайнята брифом. Нові підождуть.</p>
	{/if}
	{#each g.inbox as b (b.id)}
		<article class="brief panel rise">
			<header>
				<Avatar who="client" client={b.client} size={40} />
				<div class="who">
					<div class="client">{b.client.name}</div>
					<div class="faint biz">{b.client.business}</div>
				</div>
				<div class="fee"><Num value={b.fee} width={7} suffix=" ₴" /></div>
			</header>
			<p>«{b.text}»</p>
			<button class="btn primary" disabled={locked || live.busy} onclick={() => live.start({ briefId: b.id })}>Взяти бриф</button>
		</article>
	{:else}
		<p class="muted">На сьогодні брифів нема. Дай команді вихідний.</p>
	{/each}

	<article class="brief panel own">
		{#if !custom}
			<button class="btn human" disabled={locked} onclick={() => (custom = true)}><Icon name="plus" size={16} />Свій бриф</button>
		{:else}
			{#each FIELDS as f}
				<label class="label" for="f-{f.key}">{f.label}</label>
				{#if f.key === 'business'}
					<input id="f-{f.key}" type="text" maxlength="160" placeholder={f.hint} bind:value={form[f.key]} />
				{:else}
					<textarea id="f-{f.key}" rows="2" maxlength="400" placeholder={f.hint} bind:value={form[f.key]}></textarea>
				{/if}
			{/each}
			<div class="row">
				<button class="btn ghost" onclick={() => (custom = false)}>Скасувати</button>
				<button class="btn primary" disabled={locked || live.busy || form.business.trim().length < 3} onclick={async () => { if (await live.start({ custom: form })) { custom = false; form = empty(); } }}>Взяти</button>
			</div>
			<p class="faint small">Гонорар за свій бриф — 20 000 ₴. Клієнта-персонажа вигадаємо під твій бізнес.</p>
		{/if}
	</article>
</section>

<style lang="scss">
	.wrap {
		display: grid;
		gap: 10px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	h2 {
		font-size: 17px;
		font-weight: 600;
	}
	.brief {
		padding: 12px 14px;
		display: grid;
		gap: 10px;
		&:hover {
			border-color: var(--line-hi);
		}
	}
	header {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.who {
		flex: 1;
		min-width: 0;
	}
	.client {
		font-weight: 600;
	}
	.biz {
		font-size: 13px;
	}
	.fee {
		color: var(--text);
		font-size: 14px;
		white-space: nowrap;
	}
	p {
		font-size: 14px;
		color: var(--text-2);
	}
	.row {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
	.small {
		font-size: 12px;
	}
	.own {
		justify-items: start;
		> :global(*) {
			width: 100%;
		}
		> .btn {
			width: auto;
		}
	}
</style>
