<script lang="ts">
	import { createList } from "$lib/client/actions";
	import { db } from "$lib/client/db";
	import { liveQuery } from "dexie";
	import { syncManager } from "$lib/client/sync.svelte";
	import { onMount } from "svelte";

	let { data } = $props();

	onMount(() => {
		if (data.user) {
			syncManager.reconcileAllLists();
		}
	});

	// Live query for lists
	const lists = liveQuery(() => db.lists.toArray());

	let newListName = $state("");

	async function handleCreate() {
		if (!newListName.trim() || !data.user) return;
		await createList(newListName, data.user.id);
		newListName = "";
	}
</script>

<section class="list-section">
	{#if $lists && $lists.length > 0}
		<div class="list-grid">
			{#each $lists as list}
				<a href="/{list.slug}" class="list-card transition-all">
					<h3>{list.name}</h3>
					<span class="muted small mono">{list.slug}</span>
				</a>
			{/each}
		</div>
	{:else}
		<div class="empty-state">
			<p>No lists yet.</p>
			<p class="muted small">Create one below to get started.</p>
		</div>
	{/if}
</section>

<section class="create-section">
	<div class="input-group">
		<input
			type="text"
			placeholder="New list name..."
			bind:value={newListName}
			onkeydown={(e) => e.key === "Enter" && handleCreate()}
		/>
		<button
			class="btn-primary"
			onclick={handleCreate}
			disabled={!newListName.trim()}
		>
			Create
		</button>
	</div>
</section>

<style>
	.list-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-4);
		margin-bottom: var(--space-8);
	}

	.list-card {
		background: var(--bg-1);
		padding: var(--space-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.list-card:hover {
		border-color: var(--border-hover);
		background: var(--bg-2);
		transform: translateY(-2px);
	}

	.empty-state {
		text-align: center;
		padding: var(--space-8) 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.create-section {
		border-top: 1px solid var(--border);
		padding-top: var(--space-8);
	}
</style>
