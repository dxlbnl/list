<script lang="ts">
	import {
		addItem as addItemAction,
		deleteList,
		updateItem,
		updateItems,
		deleteItem as deleteItemAction,
		renameGroup,
		deleteGroup,
	} from "$lib/client/actions";
	import { db as dexieDb } from "$lib/client/db";
	import { liveQuery } from "dexie";
	import { goto } from "$app/navigation";
	import Dialog from "$lib/components/ui/Dialog.svelte";
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import { syncManager } from "$lib/client/sync.svelte";
	import { onMount } from "svelte";
	import { DropdownMenu } from "bits-ui";
	import { menuState } from "$lib/client/menu.svelte";
	import ListGroup from "$lib/components/ui/ListGroup.svelte";
	import { dndzone } from "svelte-dnd-action";
	import { flip } from "svelte/animate";

	let { data } = $props();

	// Live query for the list details
	const list = liveQuery(() => dexieDb.lists.get(data.listId));

	// Live query for active items
	const items = liveQuery(() =>
		dexieDb.items
			.where("listId")
			.equals(data.listId)
			.filter((item) => item.deletedAt === null)
			.sortBy("rank"),
	);

	let newItemName = $state("");

	async function handleAddItem() {
		if (!newItemName.trim()) return;

		let name = newItemName;
		let groupName = null;

		// Technical syntax: [Group Name] Item Name
		if (name.startsWith("[") && name.includes("]")) {
			const endIdx = name.indexOf("]");
			groupName = name.slice(1, endIdx).trim();
			name = name.slice(endIdx + 1).trim();
		}

		await addItemAction(data.listId, name, groupName);
		newItemName = "";
	}

	async function toggleDone(item: any) {
		await updateItem(item.id, { done: !item.done });
	}

	async function deleteItem(item: any) {
		await deleteItemAction(item.id);
	}

	// Grouping logic with local state for DnD
	let dragInProgress = $state(false);
	let localGroups = $state<Record<string, any[]>>({});

	$effect(() => {
		const allItems = $items;
		if (!dragInProgress && allItems) {
			const groups: Record<string, any[]> = {};
			allItems.forEach((item) => {
				const g = item.groupName || "GENERAL";
				if (!groups[g]) groups[g] = [];
				groups[g].push(item);
			});
			localGroups = groups;
		}
	});

	const sortedGroupNames = $derived.by(() => {
		const names = Object.keys(localGroups).sort();
		if (names.includes("GENERAL")) {
			return ["GENERAL", ...names.filter((n) => n !== "GENERAL")];
		}
		return names;
	});

	function handleDndConsider(groupName: string, e: CustomEvent<any>) {
		const { items: newItems } = e.detail;
		dragInProgress = true;
		localGroups[groupName] = newItems;
	}

	let finalizeTimeout: any;
	async function handleDndFinalize(groupName: string, e: CustomEvent<any>) {
		const { items: newItems } = e.detail;
		localGroups[groupName] = newItems;

		// Prepare batch updates
		const updates: { id: string; data: any }[] = [];

		Object.entries(localGroups).forEach(([gName, items]) => {
			const actualGroupName = gName === "GENERAL" ? null : gName;
			items.forEach((item, index) => {
				if (item.rank !== index || item.groupName !== actualGroupName) {
					updates.push({
						id: item.id,
						data: { rank: index, groupName: actualGroupName },
					});
				}
			});
		});

		if (updates.length > 0) {
			await updateItems(updates);
		}

		// Debounce setting dragInProgress to false to allow all finalize events to settle
		clearTimeout(finalizeTimeout);
		finalizeTimeout = setTimeout(() => {
			dragInProgress = false;
		}, 100);
	}

	async function handleRenameGroup(oldName: string) {
		const newName = prompt("New group name:", oldName);
		if (newName && newName !== oldName) {
			await renameGroup(
				data.listId,
				oldName === "GENERAL" ? null : oldName,
				newName,
			);
		}
	}

	async function handleDeleteGroup(groupName: string) {
		setTimeout(async () => {
			if (confirm(`Delete all items in group "${groupName}"?`)) {
				await deleteGroup(
					data.listId,
					groupName === "GENERAL" ? null : groupName,
				);
			}
		}, 100);
	}

	let isDeleteDialogOpen = $state(false);
	let confirmDeleteName = $state("");

	async function handleDeleteList() {
		const currentList = await dexieDb.lists.get(data.listId);
		if (confirmDeleteName === currentList?.name) {
			await deleteList(data.listId);
			isDeleteDialogOpen = false;
			goto("/");
		}
	}

	onMount(() => {
		syncManager.subscribeToList(data.listId);
		return () => syncManager.unsubscribeFromList(data.listId);
	});

	$effect(() => {
		menuState.setContextualSnippet(deleteMenuItem);
		return () => menuState.setContextualSnippet(null);
	});
</script>

<div class="list-controls">
	<div class="input-group">
		<div class="input-prefix">&gt;</div>
		<input
			type="text"
			placeholder="ADD ITEM OR [GROUP] ITEM"
			bind:value={newItemName}
			onkeydown={(e) => e.key === "Enter" && handleAddItem()}
		/>
		<button
			class="input-action-btn"
			onclick={handleAddItem}
			disabled={!newItemName.trim()}
		>
			ADD
		</button>
	</div>
</div>

<section class="items-section">
	{#if $items && $items.length > 0}
		<div class="groups-container">
			{#each sortedGroupNames as groupName (groupName)}
				<ListGroup
					{groupName}
					groupItems={localGroups[groupName]}
					showHeader={sortedGroupNames.length > 1}
					onRename={() => handleRenameGroup(groupName)}
					onDelete={() => handleDeleteGroup(groupName)}
					onToggleDone={toggleDone}
					onDeleteItem={deleteItem}
					onDndConsider={(e: CustomEvent<any>) =>
						handleDndConsider(groupName, e)}
					onDndFinalize={(e: CustomEvent<any>) =>
						handleDndFinalize(groupName, e)}
				/>
			{/each}
		</div>
	{:else}
		<div class="empty-state muted">
			<p>List is empty.</p>
		</div>
	{/if}
</section>

{#snippet deleteMenuItem()}
	<DropdownMenu.Item
		class="menu-item danger"
		onSelect={() => (isDeleteDialogOpen = true)}
	>
		<div class="icon-container">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M3 6h18" /><path
					d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"
				/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line
					x1="10"
					x2="10"
					y1="11"
					y2="17"
				/><line x1="14" x2="14" y1="11" y2="17" /></svg
			>
		</div>
		<span>Delete List</span>
	</DropdownMenu.Item>
{/snippet}

<Dialog
	bind:open={isDeleteDialogOpen}
	title="Delete List"
	description="This action cannot be undone. To confirm, please type the name of the list: '{$list?.name}'"
>
	<div class="qr-wrapper">
		<div class="input-group">
			<div class="input-prefix">&gt;</div>
			<input
				type="text"
				placeholder="CONFIRM_LIST_NAME"
				bind:value={confirmDeleteName}
				onkeydown={(e) => e.key === "Enter" && handleDeleteList()}
			/>
			<button
				class="input-action-btn danger"
				onclick={handleDeleteList}
				disabled={confirmDeleteName !== $list?.name}
			>
				DELETE
			</button>
		</div>
		<div class="qr-footer small muted mono">DANGER_ZONE_V1</div>
	</div>
</Dialog>

<style>
	.list-controls {
		margin-bottom: var(--space-8);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-8) 0;
		color: var(--fg-3);
	}

	.groups-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
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

		.check-box {
			width: 22px;
			height: 22px;
			border: 2px solid var(--fg-3);
			border-radius: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s;
		}

		.item-row.done .check-box {
			background: var(--accent);
			border-color: var(--accent);
		}

		.icon-done {
			color: white;
			font-size: 14px;
			font-weight: bold;
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

		.danger-zone {
			margin-top: var(--space-8);
			padding-top: var(--space-8);
			border-top: 1px solid var(--border);
			display: flex;
			flex-direction: column;
			gap: var(--space-4);
		}

		.btn-danger-outline {
			border: 1px solid var(--danger);
			color: var(--danger);
			padding: var(--space-2) var(--space-6);
			border-radius: var(--radius-md);
			font-family: var(--font-mono);
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
			transition: all 0.2s;
			cursor: pointer;
		}

		.btn-danger-outline:hover {
			background: var(--danger);
			color: white;
			box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
		}

		.btn-danger {
			background: var(--danger);
			color: white;
			padding: var(--space-2) var(--space-6);
			border-radius: var(--radius-md);
			font-family: var(--font-mono);
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
			transition: all 0.2s;
		}

		.btn-danger:hover:not(:disabled) {
			opacity: 0.9;
			transform: scale(1.02);
			box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
		}

		.btn-danger:disabled {
			opacity: 0.3;
			cursor: not-allowed;
			filter: grayscale(1);
		}

		.btn-ghost {
			padding: var(--space-2) var(--space-6);
			border-radius: var(--radius-md);
			color: var(--fg-2);
			font-family: var(--font-mono);
			font-size: 0.75rem;
			text-transform: uppercase;
			transition: all 0.2s;
		}

		.btn-ghost:hover {
			background: var(--bg-2);
			color: var(--fg-0);
		}

		.dialog-input {
			background: var(--bg-2);
			border: 1px solid var(--border);
			padding: var(--space-3) var(--space-4);
			border-radius: var(--radius-md);
			color: var(--fg-1);
			width: 100%;
		}

		.dialog-input:focus {
			border-color: var(--accent);
		}

		.dialog-actions {
			display: flex;
			justify-content: flex-end;
			gap: var(--space-3);
		}

		.qr-wrapper {
			display: flex;
			flex-direction: column;
			gap: var(--space-6);
			margin-top: var(--space-2);
		}

		.qr-wrapper .input-prefix {
			color: var(--danger);
		}

		.qr-footer {
			margin-top: var(--space-2);
			padding-top: var(--space-4);
			border-top: 1px dashed var(--border);
			opacity: 0.4;
			letter-spacing: 0.2em;
			font-size: 0.65rem;
		}

		.input-action-btn.danger {
			background: var(--danger) !important;
			color: white !important;
			border-left: 1px solid rgba(0, 0, 0, 0.2) !important;
			letter-spacing: 0.05em;
			padding: 0 var(--space-8) !important;
		}

		.input-action-btn.danger:hover:not(:disabled) {
			background: #dc2626 !important;
			box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
		}

		.input-action-btn.danger:disabled {
			background: var(--bg-2) !important;
			color: var(--fg-3) !important;
			opacity: 0.5;
		}
	}
</style>
