import { db } from '$lib/client/db';

class SyncManager {
	isSyncing = $state(false);
	isOnline = $state(true);
	lastSyncError = $state<string | null>(null);
	private eventSource: EventSource | null = null;
	private activeListIds = new Set<string>();

	constructor() {
		// Start sync loop
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;

			window.addEventListener('online', () => {
				this.isOnline = true;
				console.log('Network online: triggering sync...');
				this.connectSSE();
				this.processQueue();
				this.reconcileAllLists();
			});

			window.addEventListener('offline', () => {
				this.isOnline = false;
				console.log('Network offline');
			});

			this.startLoop();
			this.connectSSE();
		}
	}

	connectSSE() {
		if (this.eventSource && this.eventSource.readyState !== 2) return;
		
		if (this.eventSource) this.eventSource.close();
		this.eventSource = new EventSource('/api/sync');
		
		this.eventSource.onopen = () => {
			this.isOnline = true;
		};

		this.eventSource.onmessage = async (event) => {
			this.isOnline = true;
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'update' && data.listId) {
					if (data.listId === 'global') {
						console.log('Global refresh triggered');
						this.reconcileAllLists();
					} else if (data.deleted) {
						console.log(`List ${data.listId} deleted, removing locally...`);
						await db.lists.delete(data.listId);
						await db.items.where('listId').equals(data.listId).delete();
					} else if (data.list && data.items) {
						console.log(`Instant update received for ${data.listId}`);
						await this.pull(data.listId, { list: data.list, items: data.items });
					} else if (this.activeListIds.has(data.listId)) {
						await this.pull(data.listId);
					} else {
						this.reconcileAllLists();
					}
				}
			} catch (e) {
				console.error('SSE message error:', e);
			}
		};

		this.eventSource.onerror = (e) => {
			this.isOnline = false;
			console.error('SSE connection lost. Browser will retry automatically.', e);
		};
	}

	subscribeToList(listId: string) {
		this.activeListIds.add(listId);
		// Trigger initial pull
		this.pull(listId);
	}

	unsubscribeFromList(listId: string) {
		this.activeListIds.delete(listId);
	}

	async startLoop() {
		while (true) {
			try {
				await this.processQueue();
			} catch (e) {
				console.error('Sync loop error:', e);
			}
			// Wait 10 seconds before next check (SSE handles real-time)
			await new Promise(resolve => setTimeout(resolve, 10000));
		}
	}

	async processQueue() {
		if (!this.isOnline) return;

		// Check if we have work to do before setting state
		const count = await db.syncQueue.count();
		if (count === 0) return;

		this.isSyncing = true;
		this.lastSyncError = null;

		try {
			const ops = await db.syncQueue.toArray();
			const response = await fetch('/api/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operations: ops })
			});

			if (!response.ok) {
				throw new Error(`Sync failed: ${response.statusText}`);
			}

			const { results } = await response.json();

			// Remove successfully processed ops from queue
			const successfulIds = results
				.filter((r: any) => r.status === 'success')
				.map((r: any) => r.id);
			
			if (successfulIds.length > 0) {
				await db.syncQueue.bulkDelete(successfulIds);
			}

			const errors = results.filter((r: any) => r.status === 'error');
			if (errors.length > 0) {
				console.warn('Some operations failed to sync:', errors);
			}
		} catch (e) {
			this.lastSyncError = (e as Error).message;
			throw e;
		} finally {
			this.isSyncing = false;
		}
	}

	async pull(listId: string, snapshot?: { list: any, items: any[] }) {
		try {
			let list, items;

			if (snapshot) {
				list = snapshot.list;
				items = snapshot.items;
			} else {
				const response = await fetch(`/api/lists/${listId}`);
				if (!response.ok) return;
				const data = await response.json();
				list = data.list;
				items = data.items;
			}

			// Reconciliation: Only update if not pending local changes AND server is newer
			const pendingListOps = await db.syncQueue.where('entity').equals('list').toArray();
			const pendingListIds = new Set(pendingListOps.map(op => op.entityId));

			const localList = await db.lists.get(list.id);
			const serverDate = new Date(list.createdAt);
			
			if (!pendingListIds.has(list.id)) {
				// For lists, we just check existence or major changes
				if (!localList || localList.name !== list.name) {
					await db.lists.put({
						...list,
						createdAt: serverDate
					});
				}
			}

			// Update items with reconciliation
			const pendingOps = await db.syncQueue.where('entity').equals('item').toArray();
			const pendingItemIds = new Set(pendingOps.map(op => op.entityId));

			for (const item of items) {
				const localItem = await db.items.get(item.id);
				const serverUpdatedAt = new Date(item.updatedAt);
				
				// Only update if:
				// 1. We don't have pending changes for this item
				// 2. AND (we don't have the item OR the server version is strictly newer)
				const isNewer = !localItem || serverUpdatedAt > new Date(localItem.updatedAt);

				if (!pendingItemIds.has(item.id) && isNewer) {
					await db.items.put({
						...item,
						groupName: item.groupName || "",
						deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
						updatedAt: serverUpdatedAt
					});
				}
			}

			// Handle deleted items that are gone from server
			const serverItemIds = new Set(items.map((i: any) => i.id));
			const localItems = await db.items.where('listId').equals(listId).toArray();
			
			for (const localItem of localItems) {
				if (!serverItemIds.has(localItem.id) && !pendingItemIds.has(localItem.id)) {
					await db.items.delete(localItem.id);
				}
			}
		} catch (e) {
			console.error(`Pull error for list ${listId}:`, e);
		}
	}

	async reconcileAllLists() {
		if (!this.isOnline) return;
		this.isSyncing = true;
		try {
			const response = await fetch('/api/lists');
			if (!response.ok) return;

			const { lists } = await response.json();
			const pendingListOps = await db.syncQueue.where('entity').equals('list').toArray();
			const pendingListIds = new Set(pendingListOps.map(op => op.entityId));

			for (const list of lists) {
				if (!pendingListIds.has(list.id)) {
					await db.lists.put({
						...list,
						createdAt: new Date(list.createdAt)
					});
					// Also subscribe and pull items for each list
					this.subscribeToList(list.id);
				}
			}

			// Optional: Remove local lists that were deleted on server
			const serverListIds = new Set(lists.map((l: any) => l.id));
			const localLists = await db.lists.toArray();
			for (const localList of localLists) {
				if (!serverListIds.has(localList.id) && !pendingListIds.has(localList.id) && !localList.isLocalOnly) {
					await db.lists.delete(localList.id);
					await db.items.where('listId').equals(localList.id).delete();
				}
			}
		} catch (e) {
			console.error('Reconcile all lists error:', e);
		} finally {
			this.isSyncing = false;
		}
	}

	async forceSync() {
		await this.processQueue();
		for (const listId of this.activeListIds) {
			await this.pull(listId);
		}
	}
}

export const syncManager = new SyncManager();
