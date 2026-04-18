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
		<div class="input-prefix">&gt;</div>
		<input
			type="text"
			placeholder="CREATE NEW LIST"
			bind:value={newListName}
			onkeydown={(e) => e.key === "Enter" && handleCreate()}
		/>
		<button
			class="input-action-btn"
			onclick={handleCreate}
			disabled={!newListName.trim()}
		>
			CREATE
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
		position: relative;
		overflow: hidden;
	}

	.list-card::after {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--accent);
		transform: scaleY(0);
		transition: transform 0.2s;
	}

	.list-card:hover {
		border-color: var(--border-hover);
		background: var(--bg-2);
		transform: translateX(4px);
	}

	.list-card:hover::after {
		transform: scaleY(1);
	}

	.list-card h3 {
		font-size: 1rem;
		font-weight: 600;
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
