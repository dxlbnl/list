<script lang="ts">
	let { title = "Empty", message = "" } = $props();
</script>

<div class="ui-empty-state">
	<p>{title}</p>
	{#if message}
		<p class="muted small">{message}</p>
	{/if}
</div>

<style>
	:global {
		.ui-empty-state {
			text-align: center;
			padding: var(--space-12);
			border: 1px dashed var(--border);
			border-radius: var(--radius-lg);
			font-family: var(--font-mono);
			text-transform: uppercase;
			letter-spacing: 0.1em;
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			color: var(--fg-2);
		}
	}
</style>
