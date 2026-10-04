<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { TIER_NAME, tierOf } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
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

<section class="wrap" data-tour="inbox">
	<div class="head sticky">
		<h2>Вхідні брифи</h2>
		<button class="btn human sm" disabled={locked} onclick={() => (custom = true)}><Icon name="plus" size={14} />Свій бриф</button>
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
				<div class="fee"><Num value={b.fee} width={6} suffix=" ₴" /></div>
			</header>
			<p>«{b.text}»</p>
			<p class="terms faint">{b.prepay.toLocaleString('uk-UA')} ₴ одразу · {(b.fee - b.prepay).toLocaleString('uk-UA')} ₴ — коли скаже «беру» · {TIER_NAME[b.tier]}</p>
			<button class="btn primary" disabled={locked || live.busy} onclick={() => live.start({ briefId: b.id })}>Взяти бриф</button>
		</article>
	{:else}
		<p class="muted">На сьогодні брифів нема. Дай команді вихідний.</p>
	{/each}


</section>

{#if custom}
	<Modal title="Свій бриф" onClose={() => (custom = false)}>
		<div class="form">
			{#each FIELDS as f}
				<label class="label" for="f-{f.key}">{f.label}</label>
				{#if f.key === 'business'}
					<input id="f-{f.key}" type="text" maxlength="160" placeholder={f.hint} bind:value={form[f.key]} />
				{:else}
					<textarea id="f-{f.key}" rows="2" maxlength="400" placeholder={f.hint} bind:value={form[f.key]}></textarea>
				{/if}
			{/each}
			<p class="faint small">Чек на твоєму рівні — {[0, 4000, 15000, 45000][tierOf(g.reputation)].toLocaleString('uk-UA')} ₴, 20% одразу. Клієнта-персонажа вигадаємо під твій бізнес.</p>
			<div class="row">
				<button class="btn ghost" onclick={() => (custom = false)}>Скасувати</button>
				<button class="btn primary" disabled={locked || live.busy || form.business.trim().length < 3} onclick={async () => { if (await live.start({ custom: form })) { custom = false; form = empty(); } }}>Взяти бриф</button>
			</div>
		</div>
	</Modal>
{/if}

<style lang="scss">
	.terms {
		font-size: 12.5px;
		font-family: var(--pixel);
	}
	.wrap {
		display: grid;
		gap: 10px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.sticky {
		position: sticky;
		top: 52px;
		z-index: 3;
		background: var(--bg);
		padding: 4px 0 6px;
	}
	@media (max-width: 859px) {
		.sticky {
			top: var(--top-h);
		}
	}
	.form {
		display: grid;
		gap: 6px;
	}
	h2 {
		font-size: 18px;
	}
	.brief {
		padding: 12px 14px;
		display: grid;
		gap: 10px;
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
		font-family: var(--pixel);
		font-weight: 600;
		font-size: 16px;
	}
	.biz {
		font-size: 13px;
	}
	.fee {
		color: var(--human);
		font-family: var(--pixel);
		font-size: 17px;
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
</style>
