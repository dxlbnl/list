<script lang="ts">
	import { Collapsible, DropdownMenu } from "bits-ui";
	import { dndzone } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import Checkbox from "./Checkbox.svelte";
	import type { Snippet } from "svelte";

	let { 
		groupName, 
		groupItems, 
		onRename, 
		onDelete, 
		onToggleDone, 
		onDeleteItem,
		onDndConsider,
		onDndFinalize
	} = $props();

	let isOpen = $state(true);
</script>

<Collapsible.Root class="group-wrapper" bind:open={isOpen}>
	<div class="group-header-container">
		<Collapsible.Trigger class="group-header">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="chevron"
				class:rotated={isOpen}><path d="m9 18 6-6-6-6" /></svg
			>
			<span class="mono tiny uppercase tracking-widest">{groupName}</span>
			<span class="count mono tiny muted">[{groupItems.length}]</span>
		</Collapsible.Trigger>

		<div class="group-actions">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="btn-icon-tiny">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><circle cx="12" cy="12" r="1" /><circle
							cx="12"
							cy="5"
							r="1"
						/><circle cx="12" cy="19" r="1" /></svg
					>
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal disabled={true}>
					<DropdownMenu.Content
						class="menu-content mini"
						sideOffset={4}
						align="end"
					>
						<DropdownMenu.Item
							class="menu-item"
							onSelect={onRename}
						>
							<span>Rename Group</span>
						</DropdownMenu.Item>
						<DropdownMenu.Item
							class="menu-item danger"
							onSelect={onDelete}
						>
							<span>Delete Group</span>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</div>
	</div>

	<Collapsible.Content>
		<div
			class="item-stack"
			use:dndzone={{ 
				items: groupItems, 
				flipDurationMs: 200, 
				type: 'item',
				dragHandleSelector: ".drag-handle"
			}}
			onconsider={onDndConsider}
			onfinalize={onDndFinalize}
		>
			{#each groupItems as item (item.id)}
				<div animate:flip={{ duration: 200 }}>
					<li class="item-row transition-all" class:done={item.done}>
						<div class="drag-handle muted mono tiny">::</div>
						<Checkbox
							checked={item.done}
							onCheckedChange={() => onToggleDone(item)}
						/>
						<span class="item-name">{item.name}</span>
						<button
							class="btn-delete muted"
							onclick={() => onDeleteItem(item)}
						>
							×
						</button>
					</li>
				</div>
			{/each}
		</div>
	</Collapsible.Content>
</Collapsible.Root>

<style>
	.group-wrapper {
		display: flex;
		flex-direction: column;
	}

	.group-header-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.group-header {
		flex: 1;
		display: flex !important;
		flex-direction: row !important;
		align-items: center !important;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		color: var(--fg-3);
		background: transparent;
		border: none;
		cursor: pointer;
		user-select: none;
		transition: color 0.2s;
		text-align: left;

		&:hover {
			color: var(--fg-1);
		}

		.chevron {
			flex-shrink: 0;
			transition: transform 0.2s;
			&.rotated {
				transform: rotate(90deg);
			}
		}

		.count {
			opacity: 0.5;
			font-variant-numeric: tabular-nums;
		}
	}

	.group-actions {
		opacity: 0;
		transition: opacity 0.2s;
	}

	.group-header-container:hover .group-actions {
		opacity: 1;
	}

	.btn-icon-tiny {
		padding: var(--space-1);
		color: var(--fg-3);
		border-radius: var(--radius-sm);
		transition: all 0.2s;

		&:hover {
			background: var(--bg-2);
			color: var(--fg-1);
		}
	}

	:global {
		.item-stack {
			list-style: none;
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
			padding: var(--space-2) 0;
			min-height: 20px;
		}

		.item-row {
			background: var(--bg-1);
			padding: var(--space-3) var(--space-4);
			border-radius: var(--radius-md);
			border: 1px solid var(--border);
			display: flex;
			align-items: center;
			gap: var(--space-4);
			position: relative;
		}

		.drag-handle {
			cursor: grab;
			padding: var(--space-1);
			opacity: 0.3;
			transition: opacity 0.2s;
			user-select: none;

			&:hover {
				opacity: 1;
			}
		}

		.item-row.done .item-name {
			text-decoration: line-through;
			color: var(--fg-3);
		}

		.item-row:hover {
			border-color: var(--border-hover);
		}

		.item-name {
			flex: 1;
			font-size: 1rem;
		}

		.btn-delete {
			opacity: 0;
			font-family: var(--font-mono);
			font-size: 0.75rem;
			color: var(--danger);
			padding: var(--space-1) var(--space-2);
			border-radius: var(--radius-sm);
			transition: all 0.2s;
			border: 1px solid transparent;
		}

		.item-row:hover .btn-delete {
			opacity: 0.6;
		}

		.btn-delete:hover {
			opacity: 1 !important;
			background: rgba(239, 68, 68, 0.1);
			border-color: var(--danger);
		}

		/* Global DnD overrides scoped to this component's existence */
		:global(#dnd-action-dragged-el) {
			z-index: 2000 !important;
			pointer-events: none !important;
			opacity: 0.9 !important;
			box-shadow: var(--shadow-lg) !important;
			background: var(--bg-1) !important;
			border: 1px solid var(--accent) !important;
			border-radius: var(--radius-md) !important;
			padding: var(--space-3) var(--space-4);
			display: flex;
			align-items: center;
			gap: var(--space-4);
			font-family: var(--font-sans);
			color: var(--fg-1);
		}

		:global(.item-row[aria-disabled="true"]) {
			opacity: 0.3 !important;
			background: var(--bg-2) !important;
			border-style: dashed !important;
		}
	}
</style>
