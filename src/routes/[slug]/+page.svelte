<script lang="ts">
	import {
		addItem as addItemAction,
		deleteList,
		updateItem,
		deleteItem as deleteItemAction,
	} from "$lib/client/actions";
	import { db as dexieDb } from "$lib/client/db";
	import { liveQuery } from "dexie";
	import { goto } from "$app/navigation";
	import Dialog from "$lib/components/ui/Dialog.svelte";
	import Checkbox from "$lib/components/ui/Checkbox.svelte";
	import { syncManager } from "$lib/client/sync.svelte";
	import { onMount } from "svelte";

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
		await addItemAction(data.listId, newItemName);
		newItemName = "";
	}

	async function toggleDone(item: any) {
		await updateItem(item.id, { done: !item.done });
	}

	async function deleteItem(item: any) {
		await deleteItemAction(item.id);
	}

	let confirmDeleteName = $state("");
	async function handleDeleteList() {
		const currentList = await dexieDb.lists.get(data.listId);
		if (confirmDeleteName === currentList?.name) {
			await deleteList(data.listId);
			goto("/");
		}
	}

	onMount(() => {
		syncManager.subscribeToList(data.listId);
		return () => syncManager.unsubscribeFromList(data.listId);
	});
</script>

<div class="list-controls">
	<div class="input-group">
		<div class="input-prefix">&gt;</div>
		<input
			type="text"
			placeholder="ADD ITEM"
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
		<ul class="item-stack">
			{#each $items as item (item.id)}
				<li class="item-row transition-all" class:done={item.done}>
					<Checkbox
						checked={item.done}
						onCheckedChange={() => toggleDone(item)}
					/>
					<span class="item-name">{item.name}</span>
					<button
						class="btn-delete muted"
						onclick={() => deleteItem(item)}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="empty-state muted">
			<p>List is empty.</p>
		</div>
	{/if}
</section>

<section class="danger-zone">
	<Dialog
		title="Delete List"
		description="This action cannot be undone. To confirm, please type the name of the list: {$list?.name}"
	>
		{#snippet trigger()}
			<span class="btn-danger-outline transition-all">Delete List</span>
		{/snippet}

		<div class="dialog-body">
			<input
				type="text"
				placeholder="Confirm list name..."
				bind:value={confirmDeleteName}
				class="dialog-input"
			/>
			<div class="dialog-actions">
				<button
					class="btn-ghost"
					onclick={() => (confirmDeleteName = "")}>Cancel</button
				>
				<button
					class="btn-danger"
					onclick={handleDeleteList}
					disabled={confirmDeleteName !== $list?.name}
				>
					Delete Permanently
				</button>
			</div>
		</div>
	</Dialog>
</section>

<style>
	.list-controls {
		margin-bottom: var(--space-8);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-8) 0;
		color: var(--fg-3);
	}

	:global {
		.item-stack {
			list-style: none;
			display: flex;
			flex-direction: column;
			gap: var(--space-2);
		}

		.item-row {
			background: var(--bg-1);
			padding: var(--space-3) var(--space-4);
			border-radius: var(--radius-md);
			border: 1px solid var(--border);
			display: flex;
			align-items: center;
			gap: var(--space-4);
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
	}
</style>
