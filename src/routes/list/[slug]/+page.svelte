<script lang="ts">
	import { addItem as addItemAction } from "$lib/client/actions";
	import { db as dexieDb } from "$lib/client/db";
	import { liveQuery } from "dexie";

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
		await dexieDb.items.update(item.id, {
			done: !item.done,
			updatedAt: new Date(),
		});

		await dexieDb.syncQueue.add({
			type: "UPDATE",
			entity: "item",
			entityId: item.id,
			data: { done: !item.done, updatedAt: new Date() },
			timestamp: Date.now(),
		});
	}

	async function deleteItem(item: any) {
		const deletedAt = new Date();
		await dexieDb.items.update(item.id, { deletedAt });

		await dexieDb.syncQueue.add({
			type: "UPDATE",
			entity: "item",
			entityId: item.id,
			data: { deletedAt },
			timestamp: Date.now(),
		});
	}
</script>

<main class="container">
	<header>
		<a href="/" class="back-link muted small">← Back</a>
		<h1>{$list?.name ?? "Loading..."}</h1>
	</header>

	<section class="add-item">
		<div class="input-group">
			<input
				type="text"
				placeholder="Add item..."
				bind:value={newItemName}
				onkeydown={(e) => e.key === "Enter" && handleAddItem()}
			/>
			<button
				class="btn-add"
				onclick={handleAddItem}
				disabled={!newItemName.trim()}
			>
				+
			</button>
		</div>
	</section>

	<section class="items-list">
		{#if $items && $items.length > 0}
			<ul class="item-stack">
				{#each $items as item (item.id)}
					<li class="item-row transition-all" class:done={item.done}>
						<button
							class="check-box"
							onclick={() => toggleDone(item)}
						>
							{#if item.done}
								<span class="icon-done">✓</span>
							{/if}
						</button>
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
</main>

<style>
	:global {
		.back-link {
			text-decoration: none;
			display: block;
			margin-bottom: var(--space-2);
		}

		.add-item {
			margin-bottom: var(--space-6);
		}

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
			font-size: 1.25rem;
			padding: 0 var(--space-2);
			transition: opacity 0.2s;
		}

		.item-row:hover .btn-delete {
			opacity: 1;
		}

		.btn-add {
			background: var(--fg-0);
			color: var(--bg-0);
			width: 40px;
			height: 40px;
			border-radius: var(--radius-md);
			font-size: 1.5rem;
			line-height: 1;
			display: flex;
			align-items: center;
			justify-content: center;
		}
	}
</style>
