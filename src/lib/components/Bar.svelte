<script lang="ts">
	/** Ігрова шкала: 10 сегментів, підпис і число. */
	let { label, value, kind }: { label: string; value: number; kind: 'hp' | 'stress' | 'morale' } = $props();
	const v = $derived(Math.max(0, Math.min(100, Math.round(value))));
	const on = $derived(Math.round(v / 10));
</script>

<div class="bar {kind}" role="meter" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
	<span class="lb">{label}</span>
	<span class="seg">{#each Array(10) as _, i}<i class:on={i < on}></i>{/each}</span>
	<span class="n num">{v}%</span>
</div>

<style lang="scss">
	.bar {
		display: grid;
		grid-template-columns: 58px 1fr 38px;
		align-items: center;
		gap: 8px;
		font-family: var(--pixel);
		font-size: 13px;
		--c: var(--hp);
		&.stress {
			--c: var(--stress);
		}
		&.morale {
			--c: var(--morale);
		}
	}
	.lb {
		color: var(--text-2);
	}
	.n {
		text-align: right;
		color: var(--text-2);
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 2px;
		padding: 2px;
		background: #0c0d10;
		i {
			height: 8px;
			background: #2a2e36;
			&.on {
				background: var(--c);
			}
		}
	}
</style>
