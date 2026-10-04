<script lang="ts">
	import { onMount } from 'svelte';
	import { Office, type SceneInput } from '$lib/scene/office';
	import type { Role, Spot } from '$lib/types';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';

	/**
	 * Головне меню (title) і меню паузи (Esc). Поляроїди — кадри з того самого офісу гри,
	 * намальовані тим самим рендером, тож персонажі ті самі, що в роботі.
	 */
	let { mode, canContinue, onContinue, onNew, onTitle }: { mode: 'title' | 'pause'; canContinue: boolean; onContinue: () => void; onNew: () => void; onTitle: () => void } = $props();

	let help = $state(false);
	let shots = $state<{ src: string; cap: string; rot: number }[]>([]);

	const agents = (spot: Spot | Partial<Record<Role, Spot>>, status = 'idle') => {
		const at = (r: Role) => (typeof spot === 'string' ? spot : spot[r] ?? 'desk');
		return { strategist: { spot: at('strategist'), status, burnout: 20 }, copywriter: { spot: at('copywriter'), status, burnout: 40 }, designer: { spot: at('designer'), status, burnout: 30 } };
	};
	const base: Omit<SceneInput, 'agents' | 'hour'> = {
		clientInOffice: false, gptFor: null, speaking: [], board: { positioning: true, name: true, slogan: true, logo: false }, logo: null,
		sky: 'clear', reducedMotion: true, client: { gender: 'm', look: 'leather' }, away: false
	};
	/** Кадр: стан офісу + яку частину арту вирізати (x, y, ширина в пікселях арту, пропорція 4:3). */
	const FRAMES: { cap: string; input: SceneInput; crop: [number, number, number] }[] = [
		{ cap: 'Клієнт хоче лого більше', input: { ...base, agents: agents('table'), clientInOffice: true, speaking: ['client'], hour: 15 }, crop: [96, 120, 180] },
		{ cap: 'Дедлайн «на вчора»', input: { ...base, agents: agents('desk', 'thinking'), hour: 23.5, sky: 'rain' }, crop: [40, 40, 220] },
		{ cap: 'Пʼятниця, 18:00', input: { ...base, agents: agents('coffee'), hour: 18.5 }, crop: [100, 118, 168] },
		{ cap: 'Інсайт знайдено~', input: { ...base, agents: agents({ strategist: 'board' }), gptFor: 'copywriter', speaking: ['strategist'], hour: 11 }, crop: [105, 36, 190] }
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
		<p class="sub">{mode === 'title' ? 'Маленька креативна агенція. Тупі брифи. Вічне вигорання.' : 'Пауза. Команда завмерла й чекає.'}</p>
		<nav>
			{#if canContinue}<button class="btn primary wide" onclick={onContinue}><Icon name="play" size={16} />Продовжити</button>{/if}
			<button class="btn wide" class:primary={!canContinue} onclick={() => (canContinue ? confirm('Почати нову гру? Поточна агенція закриється, прогрес зітреться.') && onNew() : onNew())}><Icon name="plus" size={16} />Нова гра</button>
			<button class="btn wide" onclick={() => (help = true)}><Icon name="eye" size={16} />Як грати</button>
			<button class="btn wide" disabled title="Звук буде пізніше"><Icon name="bot" size={16} />Звук: скоро</button>
			{#if mode === 'pause'}<button class="btn ghost wide" onclick={onTitle}><Icon name="back" size={16} />Головне меню</button>{/if}
		</nav>
		<p class="faint hint">{mode === 'pause' ? 'Esc — назад до гри' : 'Esc у грі — пауза й меню'}</p>
	</div>
</div>

{#if help}
	<Modal title="Як грати" onClose={() => (help = false)}>
		<ol class="rules">
			<li>Береш бриф у «Брифах». Передплати нема: клієнт платить 60% чеку за прийняту основу і 40% за канали.</li>
			<li>Стратегиня читає бриф і радиться з колегами. Копірайтер приносить три назви — ти обираєш одну.</li>
			<li>Перед клієнтом — зведення: дай до трьох правок або одразу показуй.</li>
			<li>Клієнт бурчить уголос, а потім виносить вердикт. Ще коло з його правками — або кинь проєкт.</li>
			<li>Клікай на людей і предмети в офісі: думки, похвала, кава, піца, вихідний.</li>
			<li>Стрес росте від роботи й правок, мораль падає від незадоволених клієнтів. Відпочинок — через двері.</li>
			<li>Репутація відкриває більший бізнес і більші чеки. Але й витрати ростуть.</li>
		</ol>
	</Modal>
{/if}

<style lang="scss">
	.menu {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: grid;
		place-items: center;
		padding: 16px;
		background: radial-gradient(circle at 50% 40%, #2a1c14, #120c09 70%);
		overflow: hidden;
		&.pause {
			background: rgba(10, 6, 4, 0.72);
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
	.hint {
		font-family: var(--pixel);
		font-size: 12px;
	}
	.rules {
		display: grid;
		gap: 8px;
		padding-left: 20px;
		font-size: 14px;
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
