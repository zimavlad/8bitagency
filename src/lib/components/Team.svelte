<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { ROLE_NAME, ROLES } from '$lib/types';
	import Icon from './Icon.svelte';
	import Num from './Num.svelte';

	let { live }: { live: Live } = $props();
	const g = $derived(live.game!);
	const ABOUT = {
		strategist: 'мила, як з аніме, ріже банальність; інколи радиться з Джіпітенком',
		copywriter: 'прогресивний хіпстер-технар; до Джіпітенка бігає часто',
		designer: 'бородатий, патлатий, мовчазний; Джіпітенку не довіряє'
	};
	const level = (b: number) => (b >= 100 ? 'вигорів' : b >= 80 ? 'на межі' : b >= 50 ? 'втомлений' : b >= 25 ? 'норм' : 'бадьорий');
</script>

<section class="wrap">
	<h2>Команда</h2>
	{#each ROLES as r}
		{@const b = live.run && live.run.phase !== 'done' ? live.run.agents[r].burnout : g.burnout[r]}
		<article class="panel member">
			<div class="top">
				<span class="name">{ROLE_NAME[r]}</span>
				<span class="faint lvl">{level(b)}</span>
				<span class="num pct"><Num value={b} width={3} suffix="%" /></span>
			</div>
			<div class="bar" role="meter" aria-valuenow={b} aria-valuemin={0} aria-valuemax={100} aria-label="Вигорання"><i style:width="{b}%" class:hot={b >= 80}></i></div>
			<p class="faint small">{ABOUT[r]}{live.kb && r !== 'designer' ? ` · у базі Джіпітенка файлів: ${live.kb[r]}` : ''}</p>
		</article>
	{/each}
	<button class="btn" disabled={!!g.activeRun || live.busy || g.bankrupt} onclick={() => live.game_('rest')}><Icon name="coffee" size={16} />Вихідний: −35% втоми, −6 000 ₴</button>

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
	<button class="btn ghost sm reset" onclick={() => confirm('Почати нову гру? Прогрес зітреться.') && live.game_('reset')}><Icon name="reset" size={16} />Нова гра</button>
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
	.member {
		padding: 12px 14px;
		display: grid;
		gap: 8px;
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
	}
	.pct {
		margin-left: auto;
		font-size: 13px;
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
