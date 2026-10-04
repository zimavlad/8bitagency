<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	/**
	 * Короткий мануал для першої гри: затемнюємо все, крім одного елемента, поруч — що з ним робити.
	 * Елементи позначені data-tour; береться перший видимий (на телефоні вкладки внизу).
	 */
	let { onDone, onTab }: { onDone: () => void; onTab: (t: 'inbox' | 'work' | 'team') => void } = $props();

	const STEPS: { at: string; title: string; text: string; tab?: 'inbox' | 'work' | 'team' }[] = [
		{ at: 'tab-inbox', tab: 'inbox', title: 'Брифи', text: 'Тут вхідні брифи від бізнесу. Обери один — 20% передплати прийде одразу, решта 80% — коли клієнт прийме все.' },
		{ at: 'inbox', tab: 'inbox', title: 'Обери бриф', text: 'Читай, що хоче клієнт, і тисни «Взяти бриф». Команда почне з бренд-платформи: інсайт, позиціонування, назва, знак.' },
		{ at: 'tab-work', tab: 'work', title: 'Робота', text: 'Тут видно, що команда робить зараз, і прогрес кожного кроку. Коли треба твоє рішення — відкриється вікно: обрати назву, переглянути зведення, дати правки.' },
		{ at: 'scene', title: 'Офіс', text: 'Клікай на людей: думки, здоров’я, стрес, мораль, похвала. Клікай на предмети: кава, піца, двері — вихідний.' },
		{ at: 'scene-tools', title: 'Пауза і бриф', text: 'Пауза зупиняє команду, щоб спокійно все прочитати. «Бриф» — перечитати завдання будь-коли. Esc — меню.' },
		{ at: 'tab-team', tab: 'team', title: 'Команда', text: 'Здоров’я, стрес і мораль кожного. Втомлені й ображені працюють гірше. Вихідний допомагає, але коштує день.' },
		{ at: 'money', title: 'Гроші', text: 'Щодня — оренда й зарплати. Інвестор дав тиждень: на восьмий ранок агенція має бути в плюсі.' }
	];

	let i = $state(0);
	let r = $state<DOMRect | null>(null);
	const s = $derived(STEPS[i]);

	function measure() {
		const el = [...document.querySelectorAll<HTMLElement>(`[data-tour="${s.at}"]`)].find((e) => e.offsetParent !== null && e.getClientRects().length);
		r = el ? el.getBoundingClientRect() : null;
	}
	// крок перемикає відповідну вкладку праворуч, а підсвітку міряємо вже після перемальовки
	$effect(() => {
		const t = STEPS[i].tab;
		if (t) onTab(t);
		requestAnimationFrame(() => requestAnimationFrame(measure));
	});
	onMount(() => {
		addEventListener('resize', measure);
		return () => removeEventListener('resize', measure);
	});

	function next() {
		if (i < STEPS.length - 1) i++;
		else onDone();
	}

	const pad = 6;
	const box = $derived(r ? { l: r.left - pad, t: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 } : null);
	const W = 320;
	const tipLeft = $derived(box ? Math.max(12, Math.min(box.l + box.w / 2 - W / 2, innerWidth - W - 12)) : 0);
	// Під елементом, над ним, а якщо елемент великий (офіс) — всередині, внизу по центру.
	const spot = $derived.by((): 'below' | 'above' | 'inside' => {
		if (!box) return 'inside';
		if (box.t + box.h + 200 < innerHeight) return 'below';
		if (box.h > innerHeight * 0.6) return 'inside';
		if (box.t > 220) return 'above';
		return 'inside';
	});
	const below = $derived(spot !== 'above');
	const tipTop = $derived(box ? (spot === 'below' ? box.t + box.h + 10 : spot === 'above' ? box.t - 10 : Math.max(12, Math.min(box.t + box.h, innerHeight) - 230)) : innerHeight / 2 - 100);
</script>

<div class="tour" role="dialog" aria-modal="true" aria-label="Як грати">
	{#if box}
		<i class="dim" style:left="0" style:top="0" style:width="100%" style:height="{Math.max(0, box.t)}px"></i>
		<i class="dim" style:left="0" style:top="{box.t + box.h}px" style:width="100%" style:bottom="0"></i>
		<i class="dim" style:left="0" style:top="{box.t}px" style:width="{Math.max(0, box.l)}px" style:height="{box.h}px"></i>
		<i class="dim" style:left="{box.l + box.w}px" style:top="{box.t}px" style:right="0" style:height="{box.h}px"></i>
		<i class="ring" style:left="{box.l}px" style:top="{box.t}px" style:width="{box.w}px" style:height="{box.h}px"></i>
	{:else}
		<i class="dim" style:inset="0"></i>
	{/if}
	<div class="tip paper pop" style:left="{tipLeft}px" style:top="{tipTop}px" style:width="{W}px" style:transform={below ? 'none' : 'translateY(-100%)'}>
		<header>
			<span class="n px">{i + 1} / {STEPS.length}</span>
			<h3>{s.title}</h3>
			<button class="btn ghost sm x" onclick={onDone} aria-label="Закрити мануал" title="Закрити"><Icon name="x" size={14} /></button>
		</header>
		<p>{s.text}</p>
		<div class="acts">
			{#if i > 0}<button class="btn sm" onclick={() => i--}><Icon name="back" size={14} />Назад</button>{/if}
			<button class="btn sm human" onclick={next}>{i < STEPS.length - 1 ? 'Далі' : 'Зрозуміло'}</button>
		</div>
	</div>
</div>

<style lang="scss">
	.tour {
		position: fixed;
		inset: 0;
		z-index: 45;
	}
	.dim {
		position: fixed;
		background: rgba(8, 9, 12, 0.72);
	}
	.ring {
		position: fixed;
		border: 3px solid var(--human);
		pointer-events: none;
	}
	.tip {
		position: fixed;
		padding: 10px 12px 12px;
		display: grid;
		gap: 8px;
	}
	.pop {
		animation: none;
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		h3 {
			flex: 1;
			font-size: 17px;
		}
	}
	.n {
		font-size: 12px;
		color: #94785a;
	}
	.x {
		padding: 0 6px 2px;
		min-height: 28px;
	}
	p {
		font-size: 14px;
		line-height: 1.45;
	}
	.acts {
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}
</style>
