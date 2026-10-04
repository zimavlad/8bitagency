<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { ROLE_NAME, ROLES, TIER_NAME, dailyCost, tierOf, type Role } from '$lib/types';
	import { PROFILE } from '$lib/team';
	import Avatar from './Avatar.svelte';
	import Bar from './Bar.svelte';
	import Icon from './Icon.svelte';

	let { live, onRest, onOpen }: { live: Live; onRest: () => void; onOpen: (r: Role) => void } = $props();
	const g = $derived(live.game!);
	const run = $derived(live.run && live.run.phase !== 'done' && live.run.phase !== 'failed' ? live.run : null);
	const tier = $derived(tierOf(g.reputation));


	let editing = $state<'claude' | 'gemini' | null>(null);
	let amount = $state('');
	async function saveBalance() {
		if (editing && (await live.gameAction({ action: 'balance', provider: editing, usd: Number(amount.replace(',', '.')) }))) editing = null;
	}
	const left = (p: 'claude' | 'gemini') => Math.max(0, g.ledger[p].usd - g.ledger[p].spent);
</script>

<section class="wrap">
	<h2>Команда</h2>
	<p class="faint small">Рівень {tier}: {TIER_NAME[tier]} · щодня −{dailyCost(g.reputation, g.team).toLocaleString('uk-UA')} ₴ оренди й зарплат · клікай на людей і предмети в офісі</p>
	{#each ROLES as r}
		{@const a = run ? run.agents[r] : { burnout: g.burnout[r], morale: g.morale[r], hp: g.hp[r], doing: 'між брифами' }}
		<button class="member panel" onclick={() => onOpen(r)}>
			<Avatar who={r} size={52} />
			<div class="mb">
				<div class="top"><span class="name">{g.team[r].grade}-{ROLE_NAME[r].toLowerCase()}</span><span class="faint doing">{g.team[r].sulk ? 'ображений(а)' : a.doing}</span></div>
				<p class="faint small">Прийнятих проєктів: {g.team[r].done}{g.team[r].grade === 'junior' ? ' з 5 до розмови про middle' : ''}</p>
				<Bar label="Здоровʼя" value={a.hp} kind="hp" />
				<Bar label="Стрес" value={a.burnout} kind="stress" />
				<Bar label="Мораль" value={a.morale} kind="morale" />
				<p class="small bio">{PROFILE[r].bio}</p>
				<p class="faint small"><span class="k">Сильна сторона:</span> {PROFILE[r].strong}</p>
				<p class="faint small"><span class="k">Слабке місце:</span> {PROFILE[r].weak}</p>
				{#if live.kb && r !== 'designer' && live.kb[r]}<p class="faint small"><span class="k">Бібліотека:</span> {live.kb[r]} книжок у базі Джіпітенка</p>{/if}
			</div>
		</button>
	{/each}

	<div class="controls">
		<button class="btn" disabled={!!g.activeRun || live.busy || g.bankrupt} onclick={onRest} title={g.activeRun ? 'Посеред брифу ніхто не піде' : ''}><Icon name="door" size={16} />Вихідний для всіх</button>
	</div>

	<h2 class="mt">Рахунки API</h2>
	<div class="balances">
		{#each ['claude', 'gemini'] as const as p}
			<div class="bal panel">
				<span class="label">{p === 'claude' ? 'Claude' : 'Gemini'}</span>
				<span class="num">≈ ${left(p).toFixed(2)}</span>
				<span class="faint small">з ${g.ledger[p].usd.toFixed(2)} на {g.ledger[p].at}, витрачено ${g.ledger[p].spent.toFixed(2)}</span>
				{#if editing === p}
					<div class="row"><input type="text" inputmode="decimal" placeholder="залишок, $" bind:value={amount} /><button class="btn sm primary" onclick={saveBalance}>Ок</button></div>
				{:else}
					<button class="link faint" onclick={() => { editing = p; amount = ''; }}>оновити з консолі</button>
				{/if}
			</div>
		{/each}
	</div>

	<h2 class="mt">Історія</h2>
	{#each g.history as h}
		<div class="hist">
			<span class="dot" class:ok={h.verdict === 'ok'} class:bad={h.verdict !== 'ok'}></span>
			<span class="hn">{h.name} <span class="faint">· {h.client}</span></span>
			<span class="num">+{h.paid.toLocaleString('uk-UA')} ₴</span>
			<span class="num faint">{h.repDelta >= 0 ? '+' : ''}{h.repDelta}</span>
		</div>
	{:else}
		<p class="faint small">Ще жодного брифу.</p>
	{/each}
</section>

<style lang="scss">
	.wrap {
		display: grid;
		gap: 10px;
	}
	h2 {
		font-size: 18px;
		&.mt {
			margin-top: 8px;
		}
	}
	.controls {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.balances {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.bal {
		padding: 8px 10px;
		display: grid;
		gap: 3px;
		.num {
			font-size: 17px;
		}
		input {
			padding: 6px 8px;
		}
	}
	.row {
		display: flex;
		gap: 6px;
	}
	.member {
		padding: 10px;
		display: flex;
		gap: 12px;
		text-align: left;
		align-items: flex-start;
	}
	.mb {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 5px;
	}
	.top {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.name {
		font-family: var(--pixel);
		font-weight: 600;
		font-size: 16px;
	}
	.doing {
		font-size: 13px;
		margin-left: auto;
		text-align: right;
	}
	.small {
		font-size: 12.5px;
	}
	.bio {
		color: var(--text-2);
	}
	.k {
		font-family: var(--pixel);
		color: var(--text-2);
	}
	.link {
		justify-self: start;
		font-size: 12px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.hist {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 8px;
		align-items: center;
		font-size: 13px;
	}
	.hn {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
