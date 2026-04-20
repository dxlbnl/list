<script lang="ts">
	import Dialog from "./Dialog.svelte";
	import InputGroup from "./InputGroup.svelte";

	let { 
		open = $bindable(), 
		title = "Delete item", 
		description = "This action cannot be undone.",
		targetName,
		onConfirm,
		footerLabel = "Permanent action"
	} = $props();

	let confirmValue = $state("");

	$effect(() => {
		if (open) confirmValue = "";
	});

	function handleConfirm() {
		if (confirmValue === targetName) {
			onConfirm();
			open = false;
		}
	}
</script>

<Dialog
	bind:open
	{title}
	{description}
>
	<div class="ui-confirm-delete-wrapper">
		<InputGroup
			placeholder="Confirm name"
			bind:value={confirmValue}
			onAction={handleConfirm}
			actionLabel="Delete"
			danger
			actionDisabled={confirmValue !== targetName}
		/>
		{#if footerLabel}
			<div class="ui-confirm-delete-footer small muted mono">
				{footerLabel}
			</div>
		{/if}
	</div>
</Dialog>

<style>
	:global {
		.ui-confirm-delete-wrapper {
			display: flex;
			flex-direction: column;
			gap: var(--space-6);
			margin-top: var(--space-2);
		}

		.ui-confirm-delete-footer {
			margin-top: var(--space-2);
			padding-top: var(--space-4);
			border-top: 1px dashed var(--border);
			opacity: 0.4;
			letter-spacing: 0.2em;
			font-size: 0.65rem;
			text-align: center;
		}
	}
</style>
