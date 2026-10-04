<script lang="ts">
	import { buildSvg } from '$lib/logo';
	import { ELEMENT_OWNER, ELEMENT_TITLE, ROLE_NAME, type ElementValue } from '$lib/types';
	import Icon from './Icon.svelte';

	let { el, canEdit, editable, onEdit, onApprove }: {
		el: ElementValue;
		canEdit: boolean;
		editable: boolean;
		onEdit: (comment: string) => Promise<boolean>;
		onApprove: () => void;
	} = $props();

	let open = $state(false);
	let comment = $state('');
	let sending = $state(false);
	let showRejected = $state(false);

	async function send() {
		if (!comment.trim()) return;
		sending = true;
		const ok = await onEdit(comment);
		sending = false;
		if (ok) {
			open = false;
			comment = '';
		}
	}
	// Розмітку знака будує наш код з чисел і hex після перевірки — модель туди тексту не пише.
	const svg = $derived(el.logo ? buildSvg(el.logo) : '');
</script>

<article class="card panel rise" class:approved={el.approved}>
	<header>
		<span class="title">{ELEMENT_TITLE[el.id]}</span>
		<span class="faint owner">{ROLE_NAME[ELEMENT_OWNER[el.id]]}</span>
		{#if el.edited}<span class="tag human">твоя правка</span>{/if}
		{#if el.clientReworks}<span class="tag bad">правка клієнта</span>{/if}
	</header>

	{#if svg}
		<div class="logo">{@html svg}</div>
	{/if}
	<p class="main">{el.text}</p>
	{#if el.details.length}
		<ul>
			{#each el.details as d}<li>{d}</li>{/each}
		</ul>
	{/if}
	{#if el.rejected?.length}
		<button class="link faint" onclick={() => (showRejected = !showRejected)}>{showRejected ? 'сховати' : 'що відкинули'} ({el.rejected.length})</button>
		{#if showRejected}
			<ul class="rejected">
				{#each el.rejected as r}<li><s>{r.text}</s> <span class="faint">— {r.reason}</span></li>{/each}
			</ul>
		{/if}
	{/if}

	{#if editable}
		<footer>
			<button class="btn sm ghost" class:on={el.approved} onclick={onApprove}><Icon name="check" size={16} />{el.approved ? 'Затверджено' : 'Ок'}</button>
			{#if canEdit}
				<button class="btn sm human" onclick={() => (open = !open)}><Icon name="edit" size={16} />Правка</button>
			{:else if el.edited}
				<span class="faint small">правку використано</span>
			{/if}
		</footer>
		{#if open}
			<div class="edit rise">
				<textarea rows="2" maxlength="280" placeholder="Що змінити? Одна правка на цей елемент." bind:value={comment}></textarea>
				<button class="btn sm primary" disabled={sending || !comment.trim()} onclick={send}><Icon name="send" size={16} />{sending ? 'Переробляють…' : 'Віддати'}</button>
			</div>
		{/if}
	{/if}
</article>

<style lang="scss">
	.card {
		padding: 12px 14px;
		display: grid;
		gap: 8px;
		&:hover {
			border-color: var(--line-hi);
		}
		&.approved {
			border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
		}
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 8px;
		flex-wrap: wrap;
	}
	.title {
		font-weight: 600;
	}
	.owner {
		font-size: 12px;
	}
	.tag {
		font-size: 11px;
		padding: 1px 7px;
		border-radius: 999px;
		border: 1px solid currentColor;
		&.human {
			color: var(--human);
		}
		&.bad {
			color: var(--bad);
		}
	}
	.main {
		font-size: 15px;
	}
	ul {
		list-style: none;
		display: grid;
		gap: 3px;
		font-size: 13px;
		color: var(--text-2);
	}
	.rejected {
		font-size: 12px;
	}
	.logo {
		width: 84px;
		height: 84px;
		padding: 8px;
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		background: #fbfaf8;
		:global(svg) {
			width: 100%;
			height: 100%;
			display: block;
		}
	}
	footer {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.btn.on {
		border-color: var(--accent);
		color: var(--accent);
	}
	.edit {
		display: grid;
		gap: 8px;
		justify-items: end;
	}
	.link {
		justify-self: start;
		font-size: 12px;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.small {
		font-size: 12px;
	}
</style>
