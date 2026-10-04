<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import Icon from './Icon.svelte';
	import Num from './Num.svelte';

	let { live }: { live: Live } = $props();
	let custom = $state(false);
	let text = $state('');
	let business = $state('');
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
				<div>
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
			<label class="label" for="biz">Що за бізнес</label>
			<input id="biz" type="text" maxlength="120" placeholder="Кавʼярня на Подолі" bind:value={business} />
			<label class="label" for="txt">Бриф коротко</label>
			<textarea id="txt" rows="3" maxlength="1200" placeholder="Що треба і для кого. Можна так само сиро, як пишуть клієнти." bind:value={text}></textarea>
			<div class="row">
				<button class="btn ghost" onclick={() => (custom = false)}>Скасувати</button>
				<button class="btn primary" disabled={locked || live.busy || text.trim().length < 15} onclick={async () => { if (await live.start({ custom: { text, business } })) { custom = false; text = ''; business = ''; } }}>Взяти</button>
			</div>
			<p class="faint small">Гонорар за свій бриф — 20 000 ₴. Клієнт однаково буде тим ще персонажем.</p>
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
		justify-content: space-between;
		gap: 10px;
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
