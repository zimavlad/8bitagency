<script lang="ts">
	import { Live } from '$lib/live.svelte';
	import { CONTENT, EDIT_SLOTS, ELEMENT_TITLE, ROLE_NAME, ROLES, type ClientVerdict } from '$lib/types';
	import { caseOf } from '$lib/case';
	import Avatar from './Avatar.svelte';
	import CaseBoard from './CaseBoard.svelte';
	import PhoneMock from './PhoneMock.svelte';
	import ThreadsMock from './ThreadsMock.svelte';
	import Bar from './Bar.svelte';
	import Icon from './Icon.svelte';
	import Modal from './Modal.svelte';
	import PixelLogo from './PixelLogo.svelte';

	/**
	 * Вікна рішень гравця поверх офісу: вибір назви, зведення перед клієнтом, вердикт клієнта, оплата.
	 * Вікно можна згорнути й подивитись на офіс — тоді над сценою кнопка «Твій хід».
	 * Вердикт клієнта зʼявляється після його реплік над головою (talk мс), щоб їх встигнути прочитати.
	 */
	let { live, talk = 0, minimized = $bindable(false), waiting = $bindable(false), onDone }: { live: Live; talk?: number; minimized?: boolean; waiting?: boolean; onDone: () => void } = $props();
	const run = $derived(live.run!);
	const key = $derived(Live.key(run));
	const phase = $derived(run.phase);
	const v = $derived<ClientVerdict | undefined>(run.verdicts.at(-1));
	const name = $derived(run.brief.client.name);

	// Нове рішення — нове вікно: розгортаємо, скидаємо правки.
	let lastKey = '';
	let editing = $state(false);
	let notes = $state<string[]>(Array(EDIT_SLOTS).fill(''));
	let ready = $state(true);
	let timer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (key === lastKey) return;
		lastKey = key;
		minimized = false;
		editing = false;
		notes = Array(EDIT_SLOTS).fill('');
		clearTimeout(timer);
		const verdict = phase === 'client_decision_core' || phase === 'client_decision_content';
		ready = !verdict || !talk;
		if (!ready) timer = setTimeout(() => (ready = true), talk);
	});

	const sent = $derived(live.sent === key);
	const kind = $derived(
		phase === 'pick_name' ? 'pick' : phase === 'player_core' || phase === 'player_content' ? 'review' : run.brief.custom && (phase === 'client_core' || phase === 'client_content') ? 'self' : phase === 'client_decision_core' || phase === 'client_decision_content' ? 'verdict' : phase === 'done' && run.result ? 'result' : null
	);
	const visible = $derived(!!kind && !sent && !minimized && (kind !== 'verdict' || ready));
	$effect(() => {
		waiting = !!kind && !sent && (kind !== 'verdict' || ready);
	});

	const s = $derived(run.strategy);
	const e = $derived(run.elements);
	const fmt = (n: number) => n.toLocaleString('uk-UA');
	const isNew = (id: string) => (run.changed as string[]).includes(id);
	const hasNotes = $derived(notes.some((n) => n.trim()));
	const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

	async function sendEdits() {
		if (await live.act({ action: 'edit', notes })) editing = false;
	}
</script>

{#if visible}
	{#if kind === 'pick'}
		<Modal title="Обери назву й слоган" onClose={() => (minimized = true)} closeLabel="Згорнути, подивитись офіс">
			<p class="muted">Копірайтер приніс три. Під обрану назву дизайнер малюватиме знак, решта підуть в архів.</p>
			{#each run.options as o, i}
				<button class="opt paper" disabled={live.busy} onclick={() => live.act({ action: 'pick', index: i })}>
					<span class="on">{o.name}</span>
					<span class="os">«{o.slogan}»</span>
					<span class="ow">{o.why}</span>
				</button>
			{/each}
			<div class="actions">
				{#if run.rerolls > 0}
					<button class="btn" disabled={live.busy} onclick={() => live.act({ action: 'more' })}><Icon name="reset" size={16} />Усе не те — ще три ({run.rerolls})</button>
				{:else}
					<span class="faint small">Нових варіантів більше не буде: копірайтер видихся.</span>
				{/if}
			</div>
		</Modal>
	{:else if kind === 'review'}
		<Modal title={(run.verdicts.some((x) => x.stage === (phase === 'player_core' ? 'core' : 'content')) ? 'Після правок клієнта: ' : '') + (phase === 'player_core' ? 'бренд-платформа' : 'комунікація')} wide onClose={() => (minimized = true)} closeLabel="Згорнути, подивитись офіс">
			{#if !editing}
				{@render summary(phase === 'player_core' || phase === 'client_core')}
				<div class="actions">
					{#if run.editAvailable}
						<button class="btn human" disabled={live.busy} onclick={() => (editing = true)}><Icon name="edit" size={16} />Дати правки</button>
					{/if}
					<button class="btn primary" disabled={live.busy} onclick={() => live.act({ action: 'submit' })}><Icon name="send" size={16} />Показати клієнту</button>
				</div>
			{:else}
				<p class="muted">До трьох правок. Порожнє поле — не чіпаємо. Зміниш суть — команда підтягне назву й знак.</p>
				{#each notes as _, i}
					<textarea rows="2" maxlength="280" placeholder="Правка {i + 1}" bind:value={notes[i]}></textarea>
				{/each}
				<div class="actions">
					<button class="btn ghost" onclick={() => (editing = false)}><Icon name="back" size={16} />Назад</button>
					<button class="btn human" disabled={live.busy || !notes.some((n) => n.trim())} onclick={sendEdits}><Icon name="send" size={16} />Віддати правки</button>
				</div>
			{/if}
		</Modal>
	{:else if kind === 'self'}
		<Modal title={phase === 'client_core' ? 'Ти — клієнт: бренд-платформа' : 'Ти — клієнт: комунікація'} wide onClose={() => (minimized = true)} closeLabel="Згорнути, подивитись офіс">
			{#snippet head()}<Avatar who="client" client={run.brief.client} size={48} />{/snippet}
			{@render summary(phase === 'client_core')}
			{#if run.clientRound <= 3}
				<p class="muted">Коло {run.clientRound} з 3. Напиши до трьох правок — лисий скаже їх команді. Або бери як є.</p>
				{#each notes as _, i}
					<textarea rows="2" maxlength="280" placeholder="Що не так {i + 1}" bind:value={notes[i]}></textarea>
				{/each}
			{:else}
				<p class="muted">Три кола правок минуло. Тепер тільки «беру».</p>
			{/if}
			<div class="actions">
				<!-- Написав правки — головна дія «повернути»; «беру» тоді питає, чи викинути написане. -->
				<button class="btn" class:primary={!hasNotes} disabled={live.busy} onclick={() => (!hasNotes || confirm('Ти вписав правки. Взяти роботу без них?')) && live.act({ action: 'continue' })}><Icon name="check" size={16} />{hasNotes ? 'Беру без правок' : 'Беру'}</button>
				{#if run.clientRound <= 3}<button class="btn human" disabled={live.busy || !hasNotes} onclick={() => live.act({ action: 'feedback', notes })}><Icon name="reset" size={16} />Повернути з правками</button>{/if}
			</div>
		</Modal>
	{:else if kind === 'verdict' && v}
		<Modal title={v.verdict === 'ok' ? `${name} у захваті` : `${name} хоче правок`} onClose={() => (minimized = true)} closeLabel="Згорнути, подивитись офіс">
			{#snippet head()}<Avatar who="client" client={run.brief.client} size={48} />{/snippet}
			<p class="faint small">{v.stage === 'core' ? 'Бренд-платформа' : 'Комунікація'} · коло {v.round}</p>
			<!-- що саме клієнт оцінював -->
			<section class="shown paper">
				{#if e.logo?.logo}<PixelLogo logo={e.logo.logo} size={44} />{/if}
				<div class="st">
					<b class="px">{e.name?.text ?? '—'}</b> <span>«{e.slogan?.text ?? ''}»</span>
					{#if v.stage === 'core'}<p class="small">{e.positioning?.text}</p>{:else}<p class="small">Банер, пости Threads, Reels і ролик «{e.youtube?.text ?? ''}»</p>{/if}
				</div>
				{#if v.stage === 'content'}
					{#each [e.instagram?.image, e.youtube?.image].filter(Boolean) as src}<img class="th" {src} alt="" />{/each}
				{/if}
			</section>
			<Bar label="Настрій" value={v.mood} kind={v.mood >= 60 ? 'hp' : 'stress'} />
			<section class="sum paper">
				{#each v.lines as l}<p class="quote">«{l.replace(/^[«"“]+|[»"”]+$/g, '')}»</p>{/each}
				<p class="why">{v.reaction}</p>
			</section>
			{#if v.verdict === 'ok' && v.stage === 'content'}
				<div class="inline-board"><h3>Кейс-борд</h3><CaseBoard c={caseOf(run)} compact /></div>
			{/if}
			{#if v.demands.length}
				<section class="sum paper">
					<h3>Що хоче змінити</h3>
					<ul>{#each v.demands as d}<li>{d}</li>{/each}</ul>
				</section>
			{/if}
			<div class="actions">
				{#if v.verdict === 'rework'}
					<button class="btn danger" disabled={live.busy} onclick={() => confirm('Кинути проєкт? Лишиться тільки передплата 20%, решту клієнт не заплатить.') && live.act({ action: 'giveup' })}><Icon name="x" size={16} />Кинути проєкт</button>
					<button class="btn human" disabled={live.busy} onclick={() => live.act({ action: 'retry' })}><Icon name="reset" size={16} />Ще коло з його правками</button>
				{:else if v.verdict === 'ok' && v.stage === 'core'}
					<button class="btn primary" disabled={live.busy} onclick={() => live.act({ action: 'continue' })}><Icon name="check" size={16} />Далі: комунікація</button>
				{:else}
					<button class="btn primary" disabled={live.busy} onclick={() => live.act({ action: 'continue' })}><Icon name="coin" size={16} />Отримати оплату</button>
				{/if}
			</div>
		</Modal>
		{#if v.verdict === 'ok' && v.stage === 'content'}
			<!-- кейс-борд окремим невеликим вікном поруч -->
			<aside class="side-board panel pop" aria-label="Кейс-борд">
				<h3>Кейс-борд</h3>
				<CaseBoard c={caseOf(run)} compact />
			</aside>
		{/if}
	{:else if kind === 'result' && run.result}
		{@const r = run.result}
		<Modal title={r.verdict === 'ok' ? 'Клієнт заплатив усе' : 'Проєкт кинуто'} onClose={onDone}>
			<section class="sum paper">
				<h3>Оплата</h3>
				<p class="small">Чек {fmt(run.brief.fee)} ₴</p>
				{#each r.pay as p}<div class="row"><span>{p.label}</span><span class="num">+{fmt(p.amount)} ₴</span></div>{/each}
				<div class="row total"><span>Разом</span><span class="num">+{fmt(r.paid)} ₴</span></div>
			</section>
			<div class="kpis">
				<div><span class="label">Репутація</span><span class="num big" class:neg={r.repDelta < 0}>{sign(r.repDelta)}</span></div>
				<div><span class="label">Якість</span><span class="num big">{r.quality}</span></div>
			</div>
			<section class="sum paper">
				<h3>Команда</h3>
				{#each ROLES as role}
					<div class="row"><span>{ROLE_NAME[role]}</span><span class="small">стрес {sign(r.burnoutDelta[role])} · мораль {sign(r.moraleDelta[role])}</span></div>
				{/each}
			</section>
			{#if r.notes.length}<ul class="notes">{#each r.notes as n}<li><span class="dot bad"></span>{n}</li>{/each}</ul>{/if}
			<div class="actions"><button class="btn primary" onclick={onDone}><Icon name="inbox" size={16} />До брифів</button></div>
		</Modal>
	{/if}
{/if}


{#snippet summary(core: boolean)}
	<div class="grid" class:core>
		{#if core}
			{#if s}
				<section class="sum paper">
					<h3>Стратегія</h3>
					<dl>
						<dt>Проблема</dt><dd>{s.problem}</dd>
						<dt>Інсайт</dt><dd>{s.insight}</dd>
						<dt>Перевага</dt><dd>{s.advantage}</dd>
						<dt>Напрям</dt><dd>{s.direction}</dd>
					</dl>
				</section>
			{/if}
			{#if e.positioning}
				<section class="sum paper">
					<h3>Позиціонування {#if isNew('positioning')}<span class="new">нове</span>{/if}</h3>
					<p class="big">{e.positioning.text}</p>
					<p class="small">{e.positioning.details.join(' · ')}</p>
					{#if e.positioning.why}<p class="why">Чому так: {e.positioning.why}</p>{/if}
				</section>
			{/if}
			<section class="sum paper">
				{#if e.logo?.logo}<PixelLogo logo={e.logo.logo} size={96} />{/if}
				<h3 class="bn">{e.name?.text ?? '—'} {#if isNew('name') || isNew('slogan') || isNew('logo')}<span class="new">нове</span>{/if}</h3>
				<p class="big">«{e.slogan?.text ?? '—'}»</p>
				{#if e.name?.why}<p class="why">Назва й слоган: {e.name.why}</p>{/if}
				{#if e.logo}<p class="why">Знак: {e.logo.text}</p>{/if}
			</section>
		{:else}
			{#if e.instagram}
				<section class="sum paper">
					<h3>{ELEMENT_TITLE.instagram} {#if isNew('instagram')}<span class="new">нове</span>{/if}</h3>
					<div class="phonewrap"><PhoneMock image={e.instagram.image} brand={e.name?.text ?? ''} caption={e.instagram.text} logo={e.logo?.logo} width={200} /></div>
				</section>
			{/if}
			{#if e.youtube}
				<section class="sum paper">
					<h3>YouTube: {e.youtube.text} {#if isNew('youtube')}<span class="new">нове</span>{/if}</h3>
					{#if e.youtube.image}<img src={e.youtube.image} alt="Розкадровка" />{/if}
					<ol class="scenes">{#each e.youtube.details as d, i}<li><span class="n px">{i + 1}</span>{d}</li>{/each}</ol>
				</section>
			{/if}
			<div class="col">
				{#if e.threads}
					<section class="sum paper">
						<h3>{ELEMENT_TITLE.threads} {#if isNew('threads')}<span class="new">нове</span>{/if}</h3>
						<ThreadsMock posts={e.threads.details} brand={e.name?.text ?? ''} logo={e.logo?.logo} />
						<p class="why">Голос: {e.threads.text}</p>
					</section>
				{/if}
				{#if e.reels}
					<section class="sum paper">
						<h3>{ELEMENT_TITLE.reels} {#if isNew('reels')}<span class="new">нове</span>{/if}</h3>
						<ul>{#each e.reels.details as d}<li>{d}</li>{/each}</ul>
					</section>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

<style lang="scss">
	.shown {
		display: flex;
		gap: 10px;
		align-items: center;
		padding: 8px 10px;
		.st {
			flex: 1;
			min-width: 0;
			font-size: 14px;
		}
		.th {
			width: 54px;
			height: 40px;
			object-fit: cover;
			image-rendering: pixelated;
			border: 2px solid #3a2414;
		}
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 10px;
		align-items: start;
		&.core {
			grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		}
	}
	.col {
		display: grid;
		gap: 10px;
	}
	.bn {
		font-size: 20px !important;
	}
	.new {
		font-size: 11px;
		padding: 0 5px;
		background: var(--human);
		color: var(--human-ink);
		vertical-align: 2px;
		font-family: var(--pixel);
	}
	.side-board {
		position: fixed;
		z-index: 32;
		top: 50%;
		left: calc(50% + 252px);
		transform: translateY(-50%);
		width: min(340px, calc(50vw - 270px));
		max-height: calc(100dvh - 40px);
		overflow: auto;
		padding: 10px 12px 12px;
		display: grid;
		gap: 8px;
		h3 {
			font-size: 15px;
		}
	}
	.inline-board {
		display: none;
		gap: 8px;
		h3 {
			font-size: 15px;
		}
	}
	@media (max-width: 1180px) {
		.side-board {
			display: none;
		}
		.inline-board {
			display: grid;
		}
	}

	.phonewrap {
		display: grid;
		justify-items: center;
	}
	.scenes {
		list-style: none;
		display: grid;
		gap: 3px;
		font-size: 14px;
		li {
			display: flex;
			gap: 6px;
		}
		.n {
			flex: 0 0 18px;
			height: 18px;
			display: grid;
			place-items: center;
			background: #3a2414;
			color: var(--paper);
			font-size: 12px;
		}
	}
	.opt {
		display: grid;
		gap: 2px;
		text-align: left;
		padding: 12px 14px;
		transition: filter var(--t);
		&:hover:not(:disabled) {
			filter: brightness(1.05);
			border-image: var(--frame-gold) 3 / 3px stretch;
		}
	}
	.on {
		font-family: var(--pixel);
		font-size: 20px;
		font-weight: 600;
	}
	.os {
		font-size: 15px;
	}
	.ow {
		font-size: 13px;
		color: #6d5236;
	}
	.sum {
		padding: 10px 12px;
		display: grid;
		gap: 6px;
		h3 {
			font-size: 15px;
		}
		img {
			width: 100%;
			display: block;
			image-rendering: pixelated;
			border: 2px solid #3a2414;
		}
		ul {
			list-style: none;
			display: grid;
			gap: 3px;
			font-size: 14px;
			li::before {
				content: '— ';
			}
		}
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 10px;
		font-size: 14px;
		dt {
			font-family: var(--pixel);
			color: #94785a;
		}
	}
	.big {
		font-size: 16px;
		font-weight: 500;
	}
	.small {
		font-size: 13px;
	}
	.why {
		font-size: 13px;
		color: #6d5236;
	}
	.quote {
		font-size: 15px;
	}
	.actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
		flex-wrap: wrap;
		align-items: center;
		position: sticky;
		bottom: 0;
		padding-top: 4px;
		background: var(--surface-1);
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		font-size: 14px;
		&.total {
			font-weight: 600;
			border-top: 2px dashed #d8c096;
			padding-top: 4px;
		}
	}
	.kpis {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		div {
			display: grid;
		}
	}
	.big.num {
		font-size: 22px;
		&.neg {
			color: var(--bad);
		}
	}
	.notes {
		list-style: none;
		display: grid;
		gap: 4px;
		font-size: 13px;
		li {
			display: flex;
			gap: 8px;
			align-items: center;
		}
	}
	textarea {
		font-size: 15px;
	}
</style>
