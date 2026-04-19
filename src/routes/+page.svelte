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

	/**
	 * Compute effective slug for routing.
	 * Own lists always get their slug as-is.
	 * Shared lists get disambiguated if there's a collision with an own list.
	 */
	function getEffectiveSlug(
		list: { slug: string; createdBy: string },
		allLists: { slug: string; createdBy: string }[],
	) {
		const userId = data.user?.id;
		const isOwn = list.createdBy === userId;
		if (isOwn) return list.slug;

		// Check if the current user has their OWN list with the same slug
		const hasOwnWithSameSlug = allLists.some(
			(l) => l.slug === list.slug && l.createdBy === userId,
		);
		if (hasOwnWithSameSlug) {
			return `${list.slug}--${list.createdBy.slice(0, 8)}`;
		}
		return list.slug;
	}
</script>

<div class="home-page-container">
	<section class="list-section">
		{#if $lists && $lists.length > 0}
			<div class="list-grid">
				{#each $lists as list}
					{@const effectiveSlug = getEffectiveSlug(list, $lists)}
					{@const isShared = list.createdBy !== data.user?.id}
					<a href="/{effectiveSlug}" class="list-card transition-all">
						<h3>{list.name}</h3>
						<div class="list-card-meta">
							<span class="muted small mono">{effectiveSlug}</span>
							{#if isShared}
								<span class="shared-badge">SHARED</span>
							{/if}
						</div>
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
</div>

<style>
	:global {
		.home-page-container {
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

				&::after {
					content: "";
					position: absolute;
					left: 0;
					top: 0;
					bottom: 0;
					width: 2px;
					background: var(--accent);
					transform: scaleY(0);
					transition: transform 0.2s;
				}

				&:hover {
					border-color: var(--border-hover);
					background: var(--bg-2);
					transform: translateX(4px);

					&::after {
						transform: scaleY(1);
					}
				}

				h3 {
					font-size: 1rem;
					font-weight: 600;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.list-card-meta {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: var(--space-2);
					width: 100%;
					min-width: 0; /* Important for flex child ellipsis */
				}

				.mono.small {
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					flex: 1;
				}

				.shared-badge {
					flex-shrink: 0;
					font-size: 0.6rem;
					font-family: var(--font-mono);
					font-weight: 600;
					letter-spacing: 0.1em;
					color: var(--accent);
					background: var(--accent-muted);
					padding: 1px var(--space-2);
					border-radius: var(--radius-sm);
					border: 1px solid var(--accent);
				}
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
		}
	}
</style>
