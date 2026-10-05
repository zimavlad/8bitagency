<script lang="ts">
	import { onMount } from 'svelte';
	import { Office, type SceneInput } from '$lib/scene/office';
	import type { Role, Spot } from '$lib/types';
	import Icon from './Icon.svelte';

	/**
	 * Головне меню (title) і меню паузи (Esc). Поляроїди — кадри з того самого офісу гри,
	 * намальовані тим самим рендером, тож персонажі ті самі, що в роботі.
	 */
	let { mode, canContinue, onContinue, onNew, onTitle, onTour }: { mode: 'title' | 'pause'; canContinue: boolean; onContinue: () => void; onNew: () => void; onTitle: () => void; onTour?: () => void } = $props();

	let shots = $state<{ src: string; cap: string; rot: number }[]>([]);

	const agents = (spot: Spot | Partial<Record<Role, Spot>>, status = 'idle', burn: Partial<Record<Role, number>> = {}) => {
		const at = (r: Role) => (typeof spot === 'string' ? spot : spot[r] ?? 'desk');
		return { strategist: { spot: at('strategist'), status, burnout: burn.strategist ?? 20 }, copywriter: { spot: at('copywriter'), status, burnout: burn.copywriter ?? 40 }, designer: { spot: at('designer'), status, burnout: burn.designer ?? 30 } };
	};
	const base: Omit<SceneInput, 'agents' | 'hour'> = {
		clientInOffice: false, gptFor: null, speaking: [], board: { positioning: true, name: true, slogan: true, logo: false }, logo: null,
		sky: 'clear', reducedMotion: true, client: { gender: 'm', look: 'leather' }, away: false
	};
	/** Кадр: стан офісу + яку частину арту вирізати (x, y, ширина в пікселях арту, пропорція 4:3). */
	// Фото з телефона на корпоративі й посеред робочого дня: ті самі люди, що в грі, але без брифу.
	const FRAMES: { cap: string; input: SceneInput; crop: [number, number, number] }[] = [
		{
			cap: 'Корпоратив. Клієнта не кликали',
			input: { ...base, agents: agents('table'), hour: 21.5, still: {
				party: true, mic: 'strategist',
				place: { strategist: { gx: 3.0, gy: 2.6 }, copywriter: { gx: 3.9, gy: 2.9 }, designer: { gx: 2.2, gy: 2.9 } },
				expr: { strategist: 'laugh', copywriter: 'laugh', designer: 'happy' },
				emote: { strategist: 'note', copywriter: 'laugh', designer: 'heart' }
			} },
			crop: [110, 102, 100]
		},
		{
			cap: 'Дедлайн «на вчора»',
			input: { ...base, agents: agents('desk', 'thinking', { strategist: 70, copywriter: 85, designer: 90 }), hour: 23.5, sky: 'rain' },
			crop: [40, 40, 220]
		},
		{
			cap: 'Перегони на кріслах. Дизайнер оскаржує результат',
			input: { ...base, agents: agents('table'), hour: 17, still: {
				chair: ['copywriter', 'designer'],
				place: { copywriter: { gx: 4.6, gy: 2.3 }, designer: { gx: 3.3, gy: 2.7 }, strategist: { gx: 5.1, gy: 1.75 } },
				expr: { copywriter: 'laugh', designer: 'angry', strategist: 'happy' },
				emote: { copywriter: null, designer: 'angry', strategist: 'idea' }
			} },
			crop: [148, 116, 104]
		},
		{
			cap: 'Дизайнер прикрив очі на пʼять хвилин',
			input: { ...base, agents: agents({ strategist: 'desk', copywriter: 'table', designer: 'armchair' }), hour: 14, still: {
				stickers: 'designer',
				place: { copywriter: { gx: 1.4, gy: 3.45 } },
				expr: { designer: 'sleep', copywriter: 'wink' },
				emote: { designer: 'zzz', copywriter: null, strategist: null }
			} },
			crop: [48, 98, 92]
		}
	];

	onMount(() => {
		shots = FRAMES.map((f, i) => {
			const art = Office.still(f.input);
			const [x, y, w] = f.crop;
			const hh = Math.round((w * 3) / 4);
			const k = 3;
			const c = document.createElement('canvas');
			c.width = w * k;
			c.height = hh * k;
			const ctx = c.getContext('2d')!;
			ctx.imageSmoothingEnabled = false;
			ctx.drawImage(art, x, y, w, hh, 0, 0, w * k, hh * k);
			return { src: c.toDataURL('image/png'), cap: f.cap, rot: [-6, 4, -3, 7][i] };
		});
	});
</script>

<div class="menu" class:pause={mode === 'pause'}>
	{#if mode === 'title'}
		<div class="wall" aria-hidden="true">
			{#each shots as s, i}
				<figure class="polaroid" style:--rot="{s.rot}deg" style:--i={i}>
					<img src={s.src} alt="" />
					<figcaption>{s.cap}</figcaption>
				</figure>
			{/each}
		</div>
	{/if}
	<div class="card panel pop">
		<h1>8bitagency</h1>
		<p class="sub">{mode === 'title' ? 'Ідея була геніальна. До першого кола правок.' : 'Пауза. Видихни, клієнт не бачить.'}</p>
		<nav>
			{#if canContinue}<button class="btn primary wide" onclick={onContinue}><Icon name="play" size={16} />Продовжити</button>{/if}
			<button class="btn wide" class:primary={!canContinue} onclick={() => (canContinue ? confirm('Почати нову гру? Поточна агенція закриється, прогрес зітреться.') && onNew() : onNew())}><Icon name="plus" size={16} />Нова гра</button>
			{#if onTour}<button class="btn wide" onclick={onTour}><Icon name="eye" size={16} />Мануал</button>{/if}
			<button class="btn wide" disabled title="Звук буде пізніше"><Icon name="bot" size={16} />Звук: скоро</button>
			{#if mode === 'pause'}<button class="btn ghost wide" onclick={onTitle}><Icon name="back" size={16} />Головне меню</button>{/if}
		</nav>
	</div>
</div>



<style lang="scss">
	.menu {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: center;
		padding: 16px;
		background: radial-gradient(circle at 50% 40%, #262a33, #101215 70%);
		overflow: hidden;
		&.pause {
			background: rgba(8, 9, 12, 0.72);
		}
	}
	.wall {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		grid-template-rows: repeat(2, 1fr);
		place-items: center;
		padding: 4vmin;
		gap: 2vmin;
	}
	.polaroid {
		width: min(36vw, 340px);
		padding: 8px 8px 0;
		background: #f8f1e2;
		border: 2px solid #3a2414;
		transform: rotate(var(--rot));
		animation: drop 420ms steps(6) both;
		animation-delay: calc(var(--i) * 120ms);
		img {
			display: block;
			width: 100%;
			image-rendering: pixelated;
			border: 2px solid #3a2414;
		}
		figcaption {
			font-family: var(--pixel);
			color: #3a2414;
			font-size: clamp(12px, 1.6vw, 17px);
			text-align: center;
			padding: 6px 0 10px;
		}
		&::before {
			content: '';
			position: absolute;
			top: -10px;
			left: 50%;
			width: 54px;
			height: 18px;
			transform: translateX(-50%) rotate(-3deg);
			background: rgba(242, 216, 150, 0.75);
		}
		position: relative;
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-20px) rotate(0deg);
		}
		to {
			opacity: 1;
			transform: rotate(var(--rot));
		}
	}
	.card {
		position: relative;
		width: min(360px, 100%);
		padding: 20px 20px 16px;
		display: grid;
		gap: 12px;
		text-align: center;
		background: color-mix(in srgb, var(--surface-1) 94%, transparent);
	}
	h1 {
		font-family: var(--title);
		font-weight: 400;
		font-size: 26px;
		line-height: 1;
		color: var(--human);
	}
	.sub {
		color: var(--text-2);
		font-size: 14px;
	}
	nav {
		display: grid;
		gap: 8px;
	}

	@media (max-width: 640px) {
		.wall {
			grid-template-columns: 1fr 1fr;
			align-content: space-between;
			padding: 12px;
		}
		.polaroid {
			width: 44vw;
		}
	}
</style>
