<script lang="ts">
	import { Dialog as BitsDialog } from 'bits-ui';
	import { fly, fade } from 'svelte/transition';
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
		<BitsDialog.Overlay class="dialog-overlay" forceMount>
			{#snippet child({ props, open })}
				{#if open}
					<div {...props} transition:fade={{ duration: 200 }}></div>
				{/if}
			{/snippet}
		</BitsDialog.Overlay>
		<BitsDialog.Content class="dialog-content" forceMount>
			{#snippet child({ props, open })}
				{#if open}
					<div {...props} transition:fly={{ y: 20, duration: 300 }}>
						<BitsDialog.Title class="dialog-title">{title}</BitsDialog.Title>
						{#if description}
							<BitsDialog.Description class="muted small">
								{description}
							</BitsDialog.Description>
						{/if}
						
						<div class="dialog-body">
							{@render children()}
						</div>

						<BitsDialog.Close class="dialog-close">
							×
						</BitsDialog.Close>
					</div>
				{/if}
			{/snippet}
		</BitsDialog.Content>
	</BitsDialog.Portal>
</BitsDialog.Root>

<style>
	:global {
		.dialog-overlay {
			position: fixed;
			inset: 0;
			background: var(--overlay-bg);
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

		.dialog-close {
			position: absolute;
			top: var(--space-4);
			right: var(--space-4);
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: var(--fg-3);
			font-family: var(--font-mono);
			font-size: 1.25rem;
			border-radius: var(--radius-sm);
			transition: all 0.2s;
			cursor: pointer;

			&:hover {
				background: var(--bg-2);
				color: var(--fg-0);
			}
		}
	}
</style>
