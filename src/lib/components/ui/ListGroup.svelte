<script lang="ts">
	import { Collapsible } from "bits-ui";
	import * as Menu from "./Menu";
	import { dndzone, dragHandle } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import Checkbox from "./Checkbox.svelte";
	import Dialog from "./Dialog.svelte";

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
			use:dndzone={{
				items: groupItems,
				flipDurationMs: 200,
				type: "item",
				dropTargetStyle: {},
			}}
			onconsider={onDndConsider}
			onfinalize={onDndFinalize}
		>
			{#each groupItems as item (item.id)}
				<li
					class="list-group-item-row {item.done ? 'done' : ''}"
				>
					<div use:dragHandle class="list-group-drag-handle">
						::
					</div>
					<Checkbox
						checked={item.done}
						onCheckedChange={() => onToggleDone(item)}
					/>
					<span class="list-group-item-name">{item.name}</span>
					<button class="list-group-btn-delete" onclick={() => onDeleteItem(item)}>
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
	<div class="input-group">
		<div class="input-prefix">&gt;</div>
		<input
			type="text"
			placeholder="group name"
			bind:value={editName}
			onkeydown={(e) => {
				if (e.key === "Enter" && editName && editName !== groupName) {
					onRename(editName);
					isRenameDialogOpen = false;
				}
			}}
		/>
		<button
			class="input-action-btn"
			onclick={() => {
				onRename(editName);
				isRenameDialogOpen = false;
			}}
			disabled={!editName || editName === groupName}
		>
			Rename
		</button>
	</div>
</Dialog>

<Dialog
	bind:open={isDeleteDialogOpen}
	title="Delete group"
	description="Are you sure you want to delete '{groupName}'? All items in this group will be permanently removed."
>
	<div class="list-group-dialog-actions">
		<button
			class="btn-primary danger"
			onclick={() => {
				onDelete();
				isDeleteDialogOpen = false;
			}}
		>
			Delete group
		</button>
	</div>
</Dialog>

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
			cursor: grab;
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

		/* Dialog specific actions for ListGroup */
		.list-group-dialog-actions {
			display: flex;
			justify-content: flex-end;
			gap: var(--space-4);
			margin-top: var(--space-2);

			.btn-primary.danger {
				background: var(--danger);
				color: white;

				&:hover {
					background: var(--bg-0);
					color: var(--danger);
					border-color: var(--danger);
				}
			}
		}
	}
</style>
