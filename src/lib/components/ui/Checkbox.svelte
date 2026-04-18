<script lang="ts">
	import { Checkbox as BitsCheckbox } from "bits-ui";

	let {
		checked = false,
		onCheckedChange,
	}: {
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
	} = $props();
</script>

<BitsCheckbox.Root {checked} class="checkbox-root" {onCheckedChange}>
	{#snippet children({ checked })}
		<div class="checkbox-indicator">
			{#if checked}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="4"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="check-icon"
				>
					<polyline points="20 6 9 17 4 12" />
				</svg>
			{/if}
		</div>
	{/snippet}
</BitsCheckbox.Root>

<style>
	:global {
		.checkbox-root {
			width: 22px;
			height: 22px;
			border: 2px solid var(--fg-3);
			border-radius: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s;
			background: none;
		}

		.checkbox-root[data-state="checked"] {
			background: var(--accent);
			border-color: var(--accent);
		}

		.checkbox-indicator {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			height: 100%;
		}

		.check-icon {
			width: 14px;
			height: 14px;
			color: white;
		}
	}
</style>
