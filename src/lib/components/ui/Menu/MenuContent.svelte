<script lang="ts">
	import { DropdownMenu as BitsDropdown } from "bits-ui";
	import { fly } from "svelte/transition";
	import type { Snippet } from "svelte";

	let { 
		children, 
		class: className,
		sideOffset = 8,
		align = "center",
		...rest 
	}: { 
		children: Snippet; 
		class?: string;
		sideOffset?: number;
		align?: "start" | "center" | "end";
		[key: string]: any;
	} = $props();
</script>

<BitsDropdown.Portal>
	<BitsDropdown.Content
		class="menu-content {className || ''}"
		{sideOffset}
		{align}
		{...rest}
		forceMount
	>
		{#snippet child({ wrapperProps, props, open })}
			{#if open}
				<div {...wrapperProps}>
					<div
						{...props}
						transition:fly={{ y: 8, duration: 200 }}
					>
						{@render children()}
					</div>
				</div>
			{/if}
		{/snippet}
	</BitsDropdown.Content>
</BitsDropdown.Portal>

<style>
	:global {
		.menu-content {
			background: var(--menu-bg);
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			padding: var(--space-2);
			min-width: 260px;
			box-shadow: var(--shadow-md);
			backdrop-filter: blur(20px) saturate(180%);
			outline: none;
			z-index: 1000;

			&.mini {
				min-width: 180px;
				border-radius: var(--radius-md);
			}

			.menu-status-header {
				display: flex;
				align-items: center;
				gap: var(--space-2);
				padding: var(--space-2) var(--space-3);
				opacity: 0.8;
			}
		}
	}
</style>
