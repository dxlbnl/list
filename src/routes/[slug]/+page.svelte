<script lang="ts">
	import {
		addItem as addItemAction,
		deleteList,
		updateItem,
		updateItems,
		deleteItem as deleteItemAction,
		renameGroup,
		deleteGroup,
		shareList,
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
	import { fade } from "svelte/transition";
	import InputGroup from "$lib/components/ui/InputGroup.svelte";
	import EmptyState from "$lib/components/ui/EmptyState.svelte";
	import QRCodeDisplay from "$lib/components/ui/QRCodeDisplay.svelte";
	import ConfirmDeleteDialog from "$lib/components/ui/ConfirmDeleteDialog.svelte";
	import LoadingState from "$lib/components/ui/LoadingState.svelte";

	let { data } = $props();

	// Live query for the list details
	const list = liveQuery(() =>
		data.listId ? dexieDb.lists.get(data.listId) : undefined,
	);

	let wasLoaded = $state(false);
	let listDeleted = $state(false);

	$effect(() => {
		const currentList = $list;
		if (currentList) {
			wasLoaded = true;
		} else if (wasLoaded && !currentList) {
			listDeleted = true;
		}
	});

	// Live query for active items
	const items = liveQuery(async () => {
		if (!data.listId) return [];
		const all = await dexieDb.items
			.where("listId")
			.equals(data.listId)
			.and((item) => item.deletedAt === null)
			.toArray();
		
		return all.sort((a, b) => a.rank - b.rank);
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
		
		// Ensure atomic movement: if items are in newItems, remove them from all other groups
		const newItemIds = new Set(newItems.map((i: any) => i.id));
		Object.keys(localGroups).forEach(g => {
			if (g !== groupName) {
				localGroups[g] = localGroups[g].filter(i => !newItemIds.has(i.id));
			}
		});
		
		localGroups[groupName] = newItems;
	}

	let finalizeTimeout: any;
	async function handleDndFinalize(groupName: string, e: CustomEvent<any>) {
		const { items: newItems } = e.detail;
		
		// Ensure atomic movement on finalize as well
		const newItemIds = new Set(newItems.map((i: any) => i.id));
		Object.keys(localGroups).forEach(g => {
			if (g !== groupName) {
				localGroups[g] = localGroups[g].filter(i => !newItemIds.has(i.id));
			}
		});
		
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

		// Debounce setting dragInProgress to false to allow all finalize events to settle and DB to update
		clearTimeout(finalizeTimeout);
		finalizeTimeout = setTimeout(() => {
			dragInProgress = false;
		}, 500);
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

	// Share state
	let isShareDialogOpen = $state(false);
	let shareUrl = $state("");
	let isShareLoading = $state(false);
	let shareCopied = $state(false);
	let sharePermanent = $state(true);

	async function handleDeleteList() {
		if (!data.listId) return;
		await deleteList(data.listId);
		isDeleteDialogOpen = false;
		goto("/");
	}

	async function handleShareList() {
		if (!data.listId) return;
		isShareLoading = true;
		shareUrl = "";
		shareCopied = false;
		try {
			const expiresAt = sharePermanent
				? null
				: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

			const result = await shareList(data.listId, expiresAt);
			shareUrl = result.url;
		} catch (e) {
			console.error("Failed to generate share link:", e);
		} finally {
			isShareLoading = false;
		}
	}

	async function handleCopyShareUrl() {
		if (navigator.clipboard) {
			await navigator.clipboard.writeText(shareUrl);
		} else {
			// Fallback for non-secure contexts (like local network IPs)
			const textArea = document.createElement("textarea");
			textArea.value = shareUrl;
			textArea.style.position = "fixed";
			textArea.style.left = "-999999px";
			textArea.style.top = "-999999px";
			document.body.appendChild(textArea);
			textArea.focus();
			textArea.select();
			try {
				document.execCommand("copy");
			} catch (error) {
				console.error("Copy failed", error);
			}
			textArea.remove();
		}
		shareCopied = true;
		setTimeout(() => (shareCopied = false), 2000);
	}

	$effect(() => {
		if (isShareDialogOpen) {
			handleShareList();
		}
	});

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

{#snippet contextualMenuItems()}
	<DropdownMenu.Item
		class="menu-item"
		onSelect={() => (isShareDialogOpen = true)}
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
				><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline
					points="16 6 12 2 8 6"
				/><line x1="12" x2="12" y1="2" y2="15" /></svg
			>
		</div>
		<span>Share list</span>
	</DropdownMenu.Item>
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
		<span>Delete list</span>
	</DropdownMenu.Item>
{/snippet}

{#if listDeleted}
	<div class="list-deleted-state" transition:fade>
		<div class="error-box">
			<h2 class="mono">List deleted</h2>
			<p class="muted small">This list has been removed by the owner.</p>
			<a
				href="/"
				class="btn-primary-ghost mt-4 mono small tracking-widest"
			>
				← Back to Dashboard
			</a>
		</div>
	</div>
{:else}
	<div
		class="list-page-container"
		use:registerContextualMenu={contextualMenuItems}
	>
		<div class="list-controls">
			<InputGroup
				placeholder="Add item or [Group] item"
				bind:value={newItemName}
				onAction={handleAddItem}
				actionLabel="Add"
			/>
		</div>

		<section class="items-section">
			{#if syncManager.activePulls.includes(data.listId) && (!$items || $items.length === 0)}
				<LoadingState message="FETCHING LIST DATA" />
			{:else if $items && $items.length > 0}
				<div class="groups-container">
					{#each sortedGroupNames as groupName (groupName)}
						<ListGroup
							{groupName}
							groupItems={localGroups[groupName]}
							showHeader={sortedGroupNames.length > 1}
							onRename={(newName: string) =>
								renameGroup(data.listId, groupName, newName)}
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
				<EmptyState title="List is empty" />
			{/if}
		</section>

		<Dialog
			bind:open={isShareDialogOpen}
			title="Share List"
			description="Share this list with others. Anyone with the link can join and collaborate."
		>
			<div class="share-dialog-wrapper">
				<QRCodeDisplay url={shareUrl} isLoading={isShareLoading} />

				<div class="share-options">
					<button
						class="option-toggle"
						class:active={sharePermanent}
						onclick={() => {
							sharePermanent = true;
							handleShareList();
						}}
					>
						Permanent
					</button>
					<button
						class="option-toggle"
						class:active={!sharePermanent}
						onclick={() => {
							sharePermanent = false;
							handleShareList();
						}}
					>
						24 hours
					</button>
				</div>

				{#if shareUrl}
					<div class="share-link-row">
						<InputGroup
							prefix="🔗"
							readonly
							value={shareUrl}
							actionLabel={shareCopied ? "Copied" : "Copy"}
							onAction={handleCopyShareUrl}
						/>
					</div>
				{/if}
				<div class="share-dialog-footer small muted mono">
					{sharePermanent ? "Permanent link" : "Expires in 24h"} · Share
					active
				</div>
			</div>
		</Dialog>

		<ConfirmDeleteDialog
			bind:open={isDeleteDialogOpen}
			title="Delete list"
			description="This action cannot be undone. To confirm, please type the name of the list: '{$list?.name}'"
			targetName={$list?.name}
			onConfirm={handleDeleteList}
		/>
	</div>
{/if}

<style>
	:global {
		.list-deleted-state {
			position: fixed;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			background: var(--bg-0);
			z-index: 1000;
			padding: var(--space-8);

			.error-box {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-4);
				text-align: center;
				max-width: 400px;
				padding: var(--space-12);
				border: 1px solid var(--border);
				background: var(--bg-1);
				border-radius: var(--radius-lg);
				box-shadow: var(--shadow-lg);
			}

			h2 {
				color: var(--danger);
				font-size: 1.5rem;
				letter-spacing: 0.2em;
			}

			.mt-4 {
				margin-top: var(--space-4);
			}
		}

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
		}

		/* Portaled Dialog Elements */

		/* Share Dialog */
		.share-dialog-wrapper {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: var(--space-6);
			width: 100%;
		}

		.share-options {
			display: flex;
			background: var(--bg-2);
			padding: 2px;
			border-radius: var(--radius-md);
			border: 1px solid var(--border);
			width: 100%;

			.option-toggle {
				flex: 1;
				padding: var(--space-2) var(--space-4);
				border: none;
				background: transparent;
				color: var(--fg-3);
				font-family: var(--font-mono);
				font-size: 0.7rem;
				letter-spacing: 0.1em;
				cursor: pointer;
				border-radius: var(--radius-sm);
				transition: all 0.2s;

				&.active {
					background: var(--bg-1);
					color: var(--fg-1);
					box-shadow: var(--shadow-sm);
				}

				&:hover:not(.active) {
					color: var(--fg-2);
				}
			}
		}

		.share-link-row {
			width: 100%;
		}

		.share-dialog-footer {
			opacity: 0.4;
			letter-spacing: 0.2em;
			font-size: 0.65rem;
			text-align: center;
		}
	}
</style>
