<script lang="ts">
	import { createList } from "$lib/client/actions";
	import { db } from "$lib/client/db";
	import { liveQuery } from "dexie";

	let { data } = $props();

	// Live query for lists
	const lists = liveQuery(() => db.lists.toArray());

	let newListName = $state("");

	async function handleCreate() {
		if (!newListName.trim() || !data.user) return;
		await createList(newListName, data.user.id);
		newListName = "";
	}
</script>

<main class="container">
	<header>
		<h1>Lists</h1>
		<div class="header-actions">
			<a href="/settings" class="btn-settings muted">Settings</a>
			{#if data.user}
				<div class="user-badge mono small muted">
					ID: {data.user.id.slice(0, 8)}...
					{#if data.user.email}
						({data.user.email})
					{:else}
						<span class="status-anon">Anonymous</span>
					{/if}
				</div>
			{/if}
		</div>
	</header>

	<section class="list-section">
		{#if $lists && $lists.length > 0}
			<div class="list-grid">
				{#each $lists as list}
					<a href="/{list.slug}" class="list-card transition-all">
						<h3>{list.name}</h3>
						<span class="muted small mono"
							>{list.slug}</span
						>
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
</main>

<style>
	:global {
		.container {
			max-width: 600px;
			margin: 0 auto;
			padding: var(--space-8) var(--space-4);
		}

		header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--space-8);
			border-bottom: 1px solid var(--border);
			padding-bottom: var(--space-4);
		}

		.header-actions {
			display: flex;
			align-items: center;
			gap: var(--space-4);
		}

		.btn-settings {
			text-decoration: none;
			font-size: 0.875rem;
			padding: var(--space-1) var(--space-2);
			border-radius: var(--radius-sm);
			border: 1px solid transparent;
			transition: all 0.2s;
		}

		.btn-settings:hover {
			border-color: var(--border);
			background: var(--bg-1);
			color: var(--fg-1);
		}

		.user-badge {
			background: var(--bg-1);
			padding: var(--space-1) var(--space-3);
			border-radius: var(--radius-sm);
			border: 1px solid var(--border);
		}

		.status-anon {
			color: var(--accent);
		}

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

		.input-group {
			display: flex;
			gap: var(--space-2);
			background: var(--bg-1);
			padding: var(--space-2);
			border-radius: var(--radius-lg);
			border: 1px solid var(--border);
			box-shadow: var(--shadow-sm);
		}

		.input-group input {
			flex: 1;
			padding: var(--space-2) var(--space-4);
		}

		.btn-primary {
			background: var(--fg-0);
			color: var(--bg-0);
			padding: var(--space-2) var(--space-6);
			border-radius: var(--radius-md);
			font-weight: 500;
			transition: all 0.2s;
		}

		.btn-primary:hover:not(:disabled) {
			background: var(--fg-1);
			transform: scale(1.02);
		}

		.btn-primary:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
</style>
