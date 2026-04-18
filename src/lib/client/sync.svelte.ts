import { db } from '$lib/client/db';

class SyncManager {
	isSyncing = $state(false);
	lastSyncError = $state<string | null>(null);
	private eventSource: EventSource | null = null;
	private activeListIds = new Set<string>();

	constructor() {
		// Start sync loop
		if (typeof window !== 'undefined') {
			this.startLoop();
			this.connectSSE();
		}
	}

	connectSSE() {
		if (this.eventSource) return;

		this.eventSource = new EventSource('/api/sync');
		
		this.eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'update' && this.activeListIds.has(data.listId)) {
					console.log(`List ${data.listId} updated on server, pulling...`);
					this.pull(data.listId);
				}
			} catch (e) {
				console.error('SSE message error:', e);
			}
		};

		this.eventSource.onerror = (e) => {
			console.error('SSE error, reconnecting...', e);
			this.eventSource?.close();
			this.eventSource = null;
			setTimeout(() => this.connectSSE(), 5000);
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
		const ops = await db.syncQueue.toArray();
		if (ops.length === 0) return;

		this.isSyncing = true;
		this.lastSyncError = null;

		try {
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

	async pull(listId: string) {
		try {
			const response = await fetch(`/api/lists/${listId}`);
			if (!response.ok) return;

			const { list, items } = await response.json();

			// Update list with reconciliation
			const pendingListOps = await db.syncQueue.where('entity').equals('list').toArray();
			const pendingListIds = new Set(pendingListOps.map(op => op.entityId));

			if (!pendingListIds.has(list.id)) {
				await db.lists.put({
					...list,
					createdAt: new Date(list.createdAt)
				});
			}

			// Update items with reconciliation
			const pendingOps = await db.syncQueue.where('entity').equals('item').toArray();
			const pendingItemIds = new Set(pendingOps.map(op => op.entityId));

			for (const item of items) {
				// Only update if not pending local changes
				if (!pendingItemIds.has(item.id)) {
					await db.items.put({
						...item,
						deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
						updatedAt: new Date(item.updatedAt)
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

	async forceSync() {
		await this.processQueue();
		for (const listId of this.activeListIds) {
			await this.pull(listId);
		}
	}
}

export const syncManager = new SyncManager();
