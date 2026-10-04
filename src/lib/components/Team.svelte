<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { ROLE_NAME, ROLES, type Role } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import Num from './Num.svelte';

	let { live, onRest, onOpen }: { live: Live; onRest: () => void; onOpen: (r: Role) => void } = $props();
	const g = $derived(live.game!);
	const run = $derived(live.run && live.run.phase !== 'done' ? live.run : null);

	const WHO: Record<Role, { look: string; method: string }> = {
		strategist: { look: 'мила, як з аніме, але ріже банальність', method: 'проблема → інсайт «X — це Y» → позиціонування' },
		copywriter: { look: 'хіпстер-технар у біні', method: 'назва з ролі бренду, слоган до 6 слів' },
		designer: { look: 'бородатий, патлатий, мовчазний', method: 'одна сильна форма, два кольори' }
	};
	const mood = (b: number) => (b >= 100 ? 'вигорів' : b >= 80 ? 'на межі' : b >= 50 ? 'втомлений' : b >= 25 ? 'в ресурсі' : 'бадьорий');

	let editing = $state<'claude' | 'gemini' | null>(null);
	let amount = $state('');
	async function saveBalance() {
		if (editing && (await live.gameAction({ action: 'balance', provider: editing, usd: Number(amount.replace(',', '.')) }))) editing = null;
	}
	const left = (p: 'claude' | 'gemini') => Math.max(0, g.ledger[p].usd - g.ledger[p].spent);
</script>

<section class="wrap">
	<h2>Керування</h2>
	<div class="controls">
		{#if run}
			<button class="btn" onclick={() => live.act({ action: 'pause', on: !run.paused })}><Icon name={run.paused ? 'play' : 'pause'} size={16} />{run.paused ? 'Продовжити' : 'Пауза'}</button>
		{/if}
		<button class="btn" disabled={!!g.activeRun || live.busy || g.bankrupt} onclick={onRest}><Icon name="door" size={16} />Вихідний <span class="faint">−35% втоми · −6 000 ₴</span></button>
	</div>

	<div class="balances">
		{#each ['claude', 'gemini'] as const as p}
			<div class="bal panel">
				<span class="label">{p === 'claude' ? 'Claude' : 'Gemini'}</span>
				<span class="num">≈ $<Num value={left(p) * 100} width={5} />¢</span>
				<span class="faint small">з ${g.ledger[p].usd.toFixed(2)} на {g.ledger[p].at}, витрачено ${g.ledger[p].spent.toFixed(2)}</span>
				{#if editing === p}
					<div class="row"><input type="text" inputmode="decimal" placeholder="залишок з консолі, $" bind:value={amount} /><button class="btn sm primary" onclick={saveBalance}>Ок</button></div>
				{:else}
					<button class="link faint" onclick={() => { editing = p; amount = ''; }}>оновити з консолі</button>
				{/if}
			</div>
		{/each}
	</div>

	<h2 class="mt">Команда</h2>
	{#each ROLES as r}
		{@const b = run ? run.agents[r].burnout : g.burnout[r]}
		<button class="member panel" onclick={() => onOpen(r)}>
			<Avatar who={r} size={48} />
			<div class="mb">
				<div class="top"><span class="name">{ROLE_NAME[r]}</span><span class="faint lvl">{mood(b)}</span></div>
				<div class="doing">{run ? run.agents[r].doing : 'відпочиває між брифами'}</div>
				<div class="bar" role="meter" aria-valuenow={b} aria-valuemin={0} aria-valuemax={100} aria-label="Вигорання"><i style:width="{b}%" class:hot={b >= 80}></i></div>
				<p class="faint small">{WHO[r].look} · {WHO[r].method}{live.kb && r !== 'designer' && live.kb[r] ? ` · прочитав(ла) ${live.kb[r]} книжок` : ''}</p>
			</div>
		</button>
	{/each}

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
	<button class="btn ghost sm reset" onclick={() => confirm('Почати нову гру? Прогрес зітреться.') && live.gameAction({ action: 'reset' })}><Icon name="reset" size={16} />Нова гра</button>
</section>

<style lang="scss">
	.wrap {
		display: grid;
		gap: 10px;
	}
	h2 {
		font-size: 17px;
		font-weight: 600;
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
		padding: 10px 12px;
		display: grid;
		gap: 3px;
		.num {
			font-size: 16px;
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
		padding: 12px;
		display: flex;
		gap: 12px;
		text-align: left;
		transition: border-color var(--t) var(--ease);
		&:hover {
			border-color: var(--line-hi);
		}
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
		font-weight: 600;
	}
	.lvl {
		font-size: 13px;
		margin-left: auto;
	}
	.doing {
		font-size: 14px;
	}
	.bar {
		height: 6px;
		border-radius: 3px;
		background: var(--surface-3);
		overflow: hidden;
		i {
			display: block;
			height: 100%;
			background: var(--warn);
			transition: width 250ms var(--ease);
			&.hot {
				background: var(--bad);
			}
		}
	}
	.small {
		font-size: 12px;
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
	.reset {
		justify-self: start;
	}
</style>
