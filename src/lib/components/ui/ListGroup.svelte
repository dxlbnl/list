<script lang="ts">
	import { Collapsible } from "bits-ui";
	import * as Menu from "./Menu";
	import { dragHandleZone, dragHandle } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import Checkbox from "./Checkbox.svelte";
	import Dialog from "./Dialog.svelte";
	import InputGroup from "./InputGroup.svelte";
	import ConfirmDeleteDialog from "./ConfirmDeleteDialog.svelte";

	let {
		groupName,
		groupItems,
		onRename,
		onDelete,
		onToggleDone,
		onDeleteItem,
		onDndConsider,
		onDndFinalize,
		showHeader = true,
	} = $props();

	let isOpen = $state(true);
	let isRenameDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let editName = $state("");

	$effect(() => {
		if (isRenameDialogOpen) editName = groupName;
	});
</script>

<Collapsible.Root class="list-group-container" bind:open={isOpen}>
	{#if showHeader}
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
				<span class="mono tiny uppercase tracking-widest"
					>{groupName}</span
				>
				<span class="count mono tiny muted">[{groupItems.length}]</span>
			</Collapsible.Trigger>

			<div class="group-actions">
				<Menu.Root>
					<Menu.Trigger class="btn-icon-tiny">
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
					</Menu.Trigger>
					<Menu.Content class="mini" sideOffset={4} align="end">
						<Menu.Item onSelect={() => (isRenameDialogOpen = true)}>
							<span>Rename group</span>
						</Menu.Item>
						<Menu.Item
							danger
							onSelect={() => (isDeleteDialogOpen = true)}
						>
							<span>Delete group</span>
						</Menu.Item>
					</Menu.Content>
				</Menu.Root>
			</div>
		</div>
	{/if}

	<Collapsible.Content>
		<div
			class="list-group-item-stack"
			use:dragHandleZone={{
				items: groupItems,
				flipDurationMs: 200,
			}}
			onconsider={onDndConsider}
			onfinalize={onDndFinalize}
		>
			{#each groupItems as item (item.id)}
				<li
					class="list-group-item-row {item.done ? 'done' : ''}"
					animate:flip={{ duration: 200 }}
				>
					<div use:dragHandle class="list-group-drag-handle">::</div>
					<Checkbox
						checked={item.done}
						onCheckedChange={() => onToggleDone(item)}
					/>
					<span class="list-group-item-name">{item.name}</span>
					<button
						class="list-group-btn-delete"
						onclick={() => onDeleteItem(item)}
					>
						×
					</button>
				</li>
			{/each}
		</div>
	</Collapsible.Content>
</Collapsible.Root>

<Dialog
	bind:open={isRenameDialogOpen}
	title="Rename group"
	description="Enter a new name for this group."
>
	<InputGroup
		placeholder="group name"
		bind:value={editName}
		onAction={() => {
			onRename(editName);
			isRenameDialogOpen = false;
		}}
		actionLabel="Rename"
		disabled={!editName || editName === groupName}
	/>
</Dialog>

<ConfirmDeleteDialog
	bind:open={isDeleteDialogOpen}
	title="Delete group"
	description="Are you sure you want to delete '{groupName}'? All items in this group will be permanently removed."
	targetName={groupName}
	onConfirm={onDelete}
/>

<style>
	:global {
		.list-group-container {
			display: flex;
			flex-direction: column;

			.group-header-container {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--space-2);

				&:hover .group-actions {
					opacity: 1;
				}
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
				opacity: 0.7;
				transition: opacity 0.2s;
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
		}

		/* Portaled Item Styles (to be safe during Drag & Drop) */
		.list-group-item-stack {
			list-style: none;
			display: flex;
			flex-direction: column;
			padding: var(--space-2) 0;
			min-height: 20px;
			width: 100%;
		}

		.list-group-item-row {
			background: var(--bg-1);
			padding: var(--space-3) var(--space-4);
			border-radius: var(--radius-md);
			border: 1px solid var(--border);
			display: flex;
			align-items: center;
			gap: var(--space-4);
			position: relative;
			margin-bottom: var(--space-2);
			box-sizing: border-box;
			width: 100%;

			&.done .list-group-item-name {
				text-decoration: line-through;
				color: var(--fg-3);
			}

			&:hover {
				border-color: var(--border-hover);
			}
		}

		.list-group-drag-handle {
			padding: var(--space-1);
			opacity: 0.3;
			transition: opacity 0.2s;
			user-select: none;
			font-family: var(--font-mono);
			font-size: 0.7rem;
			color: var(--fg-3);

			&:hover {
				opacity: 1;
			}
		}

		.list-group-item-name {
			flex: 1;
			font-size: 1rem;
		}

		.list-group-btn-delete {
			opacity: 1;
			font-family: var(--font-mono);
			font-size: 1.5rem;
			line-height: 1.1;
			color: var(--danger);
			padding: var(--space-1);
			border-radius: var(--radius-sm);
			transition: all 0.2s;
			border: 1px solid transparent;

			&:hover {
				background: var(--danger-muted);
				border-color: var(--danger);
			}
		}

		/* The element currently being dragged by svelte-dnd-action */
		#dnd-action-dragged-el {
			z-index: 2000 !important;
			pointer-events: none !important;
			opacity: 0.95 !important;
			box-shadow: var(--shadow-xl) !important;
			border-color: var(--accent) !important;
			transition: none !important;
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: var(--space-4) !important;
		}

	}
</style>
