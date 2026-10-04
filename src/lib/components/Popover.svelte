<script lang="ts">
	import type { Live } from '$lib/live.svelte';
	import { DAILY_COST, PIZZA_COST, ROLE_NAME, ROLES, tierOf, type Role } from '$lib/types';
	import { PROFILE } from '$lib/team';
	import Avatar from './Avatar.svelte';
	import Bar from './Bar.svelte';
	import Icon from './Icon.svelte';

	/** Маленьке вікно біля того, на що клікнули в офісі: хто це, як почувається і що можна зробити. */
	type Target = Role | 'client' | 'coffee' | 'pizza' | 'door';
	let { live, what, x, y, w, h, onClose, onThoughts, onRest }: { live: Live; what: Target; x: number; y: number; w: number; h: number; onClose: () => void; onThoughts: (who: Role | 'client') => void; onRest: () => void } = $props();

	const g = $derived(live.game!);
	const run = $derived(live.run && live.run.phase !== 'done' && live.run.phase !== 'failed' ? live.run : null);
	const role = $derived((ROLES as string[]).includes(what) ? (what as Role) : null);
	const stats = $derived(role ? (run ? run.agents[role] : { burnout: g.burnout[role], morale: g.morale[role], hp: g.hp[role], doing: 'між брифами' }) : null);
	const mood = $derived(live.run?.verdicts.at(-1)?.mood);
	const praised = $derived(!!role && g.perks.praised.includes(role));


	// Вікно біля кліку, але в межах сцени.
	const W = 270;
	const left = $derived(Math.max(8, Math.min(x - W / 2, w - W - 8)));
	const top = $derived(y > h * 0.55 ? Math.max(8, y - 230) : Math.min(y + 16, h - 200));

	async function perk(kind: 'coffee' | 'pizza' | 'praise') {
		const ok = await live.gameAction({ action: 'perk', kind, role: role ?? undefined });
		if (ok) live.say(kind === 'coffee' ? 'Кава зварилась: стрес команди −6' : kind === 'pizza' ? `Піца приїхала: мораль команди +8, −${PIZZA_COST} ₴` : `${ROLE_NAME[role!]}: мораль +6`);
		else if (live.error) live.say(live.error);
		onClose();
	}
</script>

<div class="pop-back" role="presentation" onclick={onClose}></div>
<div class="pv panel pop" style:left="{left}px" style:top="{top}px" style:width="{W}px" role="dialog" aria-label="Що можна зробити">
	{#if role && stats}
		<header>
			<Avatar who={role} size={40} />
			<div><div class="nm">{ROLE_NAME[role]}</div><div class="faint small">{stats.doing}</div></div>
		</header>
		<Bar label="Здоровʼя" value={stats.hp} kind="hp" />
		<Bar label="Стрес" value={stats.burnout} kind="stress" />
		<Bar label="Мораль" value={stats.morale} kind="morale" />
		<p class="small muted">Сильна сторона: {PROFILE[role].strong}.</p>
		<p class="small muted">Любить: {PROFILE[role].likes}.</p>
		<div class="acts">
			<button class="btn sm" onclick={() => onThoughts(role)}><Icon name="eye" size={14} />Думки</button>
			<button class="btn sm human" disabled={praised || live.busy} title={praised ? 'Сьогодні вже хвалив' : ''} onclick={() => perk('praise')}><Icon name="heart" size={14} />Похвалити</button>
		</div>
	{:else if what === 'client' && live.run}
		<header>
			<Avatar who="client" client={live.run.brief.client} size={40} />
			<div><div class="nm">{live.run.brief.client.name}</div><div class="faint small">{live.run.brief.client.business}</div></div>
		</header>
		{#if mood !== undefined}<Bar label="Настрій" value={mood} kind={mood >= 60 ? 'hp' : 'stress'} />{/if}
		<p class="small muted">{live.run.brief.client.archetype}</p>
		<div class="acts"><button class="btn sm" onclick={() => onThoughts('client')}><Icon name="eye" size={14} />Що казав</button></div>
	{:else if what === 'coffee'}
		<div class="nm">Крапельна кавоварка</div>
		<p class="small muted">Кава всім: стрес команди −6. Раз на день.</p>
		<div class="acts"><button class="btn sm primary" disabled={g.perks.coffee || live.busy} onclick={() => perk('coffee')}><Icon name="coffee" size={14} />{g.perks.coffee ? 'Сьогодні вже варили' : 'Зварити каву'}</button></div>
	{:else if what === 'pizza'}
		<div class="nm">Коробка з-під піци</div>
		<p class="small muted">Замовити ще одну на всіх: мораль +8, −{PIZZA_COST} ₴. Раз на день.</p>
		<div class="acts"><button class="btn sm human" disabled={g.perks.pizza || g.money < PIZZA_COST || live.busy} onclick={() => perk('pizza')}><Icon name="pizza" size={14} />{g.perks.pizza ? 'Сьогодні вже була' : 'Замовити піцу'}</button></div>
	{:else if what === 'door'}
		<div class="nm">Двері</div>
		{#if g.activeRun && run}
			<p class="small muted">Посеред брифу ніхто не піде додому. Спершу закінчи проєкт.</p>
		{:else}
			<p class="small muted">Вихідний: стрес −35, мораль +10. День минає, оренда й зарплати −{DAILY_COST[tierOf(g.reputation)].toLocaleString('uk-UA')} ₴.</p>
			<div class="acts"><button class="btn sm primary" disabled={live.busy || g.bankrupt} onclick={() => { onClose(); onRest(); }}><Icon name="door" size={14} />Відпустити всіх</button></div>
		{/if}
	{/if}
</div>

<style lang="scss">
	.pop-back {
		position: fixed;
		inset: 0;
		z-index: 6;
	}
	.pv {
		position: absolute;
		z-index: 7;
		padding: 10px 12px 12px;
		display: grid;
		gap: 8px;
	}
	header {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.nm {
		font-family: var(--pixel);
		font-size: 17px;
		font-weight: 600;
	}
	.small {
		font-size: 13px;
		line-height: 1.4;
	}
	.acts {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
</style>
