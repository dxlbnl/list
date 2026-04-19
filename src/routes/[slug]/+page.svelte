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
	import { syncManager } from "$lib/client/sync.svelte";
	import { onMount } from "svelte";
	import { DropdownMenu } from "bits-ui";
	import { menuState } from "$lib/client/menu.svelte";
	import ListGroup from "$lib/components/ui/ListGroup.svelte";

	let { data } = $props();

	// Live query for the list details
	const list = liveQuery(() =>
		data.listId ? dexieDb.lists.get(data.listId) : undefined,
	);

	// Live query for active items
	const items = liveQuery(() => {
		if (!data.listId) return [];
		return dexieDb.items
			.where("listId")
			.equals(data.listId)
			.and((item) => item.deletedAt === null)
			.toArray();
	});

	let newItemName = $state("");

	async function handleAddItem() {
		if (!newItemName.trim() || !data.listId) return;

		const match = newItemName.match(/^\[(.*?)\]\s*(.*)$/);
		let groupName = "";
		let itemName = newItemName.trim();

		if (match) {
			groupName = match[1].trim();
			itemName = match[2].trim();
		}

		if (!itemName) return;

		// If no group specified, use the first existing group
		if (!groupName && sortedGroupNames.length > 0) {
			const firstGroup = sortedGroupNames[0];
			groupName = firstGroup === "GENERAL" ? "" : firstGroup;
		}

		await addItemAction(data.listId, itemName, groupName);
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

		const updates: { id: string; data: any }[] = [];

		Object.entries(localGroups).forEach(([gName, items]) => {
			const actualGroupName = gName === "GENERAL" ? "" : gName;
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

	async function handleRenameGroup(oldName: string, newName: string) {
		if (newName && newName !== oldName && data.listId) {
			const actualOldName = oldName === "GENERAL" ? "" : oldName;
			await renameGroup(data.listId, actualOldName, newName);
		}
	}

	async function handleDeleteGroup(groupName: string) {
		if (data.listId) {
			const actualGroupName = groupName === "GENERAL" ? "" : groupName;
			await deleteGroup(data.listId, actualGroupName);
		}
	}

	let isDeleteDialogOpen = $state(false);
	let confirmDeleteName = $state("");

	async function handleDeleteList() {
		if (!data.listId) return;
		const currentList = await dexieDb.lists.get(data.listId);
		if (confirmDeleteName === currentList?.name) {
			await deleteList(data.listId);
			isDeleteDialogOpen = false;
			goto("/");
		}
	}

	onMount(() => {
		const listId = data.listId;
		if (listId) {
			syncManager.subscribeToList(listId);
			return () => syncManager.unsubscribeFromList(listId);
		}
	});

	function registerContextualMenu(node: HTMLElement, snippet: any) {
		menuState.setContextualSnippet(snippet);
		return {
			destroy() {
				menuState.setContextualSnippet(null);
			},
		};
	}
</script>

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

<div class="list-page-container" use:registerContextualMenu={deleteMenuItem}>
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
						onRename={(newName: string) =>
							handleRenameGroup(groupName, newName)}
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

	<Dialog
		bind:open={isDeleteDialogOpen}
		title="Delete List"
		description="This action cannot be undone. To confirm, please type the name of the list: '{$list?.name}'"
	>
		<div class="list-page-dialog-wrapper">
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
			<div class="list-page-dialog-footer small muted mono">
				DANGER_ZONE_V1
			</div>
		</div>
	</Dialog>
</div>

<style>
	:global {
		.list-page-container {
			.list-controls {
				margin-bottom: var(--space-8);
			}

			.items-section {
				display: flex;
				flex-direction: column;
				gap: var(--space-8);
			}

			.groups-container {
				display: flex;
				flex-direction: column;
				gap: var(--space-6);
			}

			.empty-state {
				text-align: center;
				padding: var(--space-12);
				border: 1px dashed var(--border);
				border-radius: var(--radius-lg);
				font-family: var(--font-mono);
				text-transform: uppercase;
				letter-spacing: 0.1em;
			}
		}

		/* Portaled Dialog Elements */
		.list-page-dialog-wrapper {
			display: flex;
			flex-direction: column;
			gap: var(--space-6);
			margin-top: var(--space-2);

			.input-prefix {
				color: var(--danger);
			}

			.input-action-btn.danger {
				background: var(--danger) !important;
				color: white !important;
				border-left: 1px solid rgba(0, 0, 0, 0.2) !important;
				letter-spacing: 0.05em;
				padding: 0 var(--space-8) !important;

				&:hover:not(:disabled) {
					background: #dc2626 !important;
					box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
				}

				&:disabled {
					background: var(--bg-2) !important;
					color: var(--fg-3) !important;
					opacity: 0.5;
				}
			}
		}

		.list-page-dialog-footer {
			margin-top: var(--space-2);
			padding-top: var(--space-4);
			border-top: 1px dashed var(--border);
			opacity: 0.4;
			letter-spacing: 0.2em;
			font-size: 0.65rem;
		}
	}
</style>
