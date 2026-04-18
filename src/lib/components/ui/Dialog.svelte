<script lang="ts">
	import { Dialog as BitsDialog } from 'bits-ui';
	import type { Snippet } from 'svelte';

	let { 
		open = $bindable(false), 
		trigger, 
		title, 
		description, 
		children 
	}: {
		open?: boolean;
		trigger?: Snippet;
		title: string;
		description?: string;
		children: Snippet;
	} = $props();
</script>

<BitsDialog.Root bind:open>
	{#if trigger}
		<BitsDialog.Trigger>
			{@render trigger()}
		</BitsDialog.Trigger>
	{/if}
	
	<BitsDialog.Portal>
		<BitsDialog.Overlay class="dialog-overlay" />
		<BitsDialog.Content class="dialog-content">
			<BitsDialog.Title class="dialog-title">{title}</BitsDialog.Title>
			{#if description}
				<BitsDialog.Description class="muted small">
					{description}
				</BitsDialog.Description>
			{/if}
			
			<div class="dialog-body">
				{@render children()}
			</div>
		</BitsDialog.Content>
	</BitsDialog.Portal>
</BitsDialog.Root>

<style>
	:global {
		.dialog-overlay {
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.8);
			backdrop-filter: blur(4px);
			z-index: 100;
		}

		.dialog-content {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 90vw;
			max-width: 450px;
			background: var(--bg-1);
			padding: var(--space-8);
			border-radius: var(--radius-lg);
			border: 1px solid var(--border);
			box-shadow: var(--shadow-md);
			z-index: 101;
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
		}

		.dialog-title {
			font-size: 1.25rem;
			font-weight: 600;
			color: var(--fg-0);
		}

		.dialog-body {
			display: flex;
			flex-direction: column;
			gap: var(--space-6);
		}
	}
</style>
