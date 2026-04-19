import { db } from '$lib/client/db';
import { logger } from '$lib/logger';

const syncLogger = logger.child({ module: 'client-sync' });

class SyncManager {
	isSyncing = $state(false);
	isOnline = $state(true);
	lastSyncError = $state<string | null>(null);
	private activeListIds = new Set<string>();
	private clientId = Math.random().toString(36).substring(7);

	constructor() {
		// Start sync loop
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;

			window.addEventListener('online', async () => {
				this.isOnline = true;
				syncLogger.info('Network online: triggering sync...');
				this.connectSSE();
				// Run in parallel for faster recovery
				await Promise.all([
					this.processQueue(),
					this.reconcileAllLists(),
					...Array.from(this.activeListIds).map(id => this.pull(id))
				]);
			});

			window.addEventListener('offline', () => {
				this.isOnline = false;
				syncLogger.info('Network offline');
			});

			this.startLoop();
			this.connectSSE();
		}
	}

	connectSSE() {
		if (this.eventSource && this.eventSource.readyState !== 2) return;
		
		if (this.eventSource) this.eventSource.close();
		this.eventSource = new EventSource(`/api/sync?clientId=${this.clientId}`);
		
		this.eventSource.onopen = () => {
			this.isOnline = true;
		};

		this.eventSource.onmessage = async (event) => {
			this.isOnline = true;
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'update' && data.listId) {
					if (data.listId === 'global') {
						syncLogger.debug('Global refresh triggered');
						this.reconcileAllLists();
					} else if (data.deleted) {
						syncLogger.info(`List deleted, removing locally`, { listId: data.listId });
						await db.lists.delete(data.listId);
						await db.items.where('listId').equals(data.listId).delete();
					} else if (data.list && data.items) {
						syncLogger.debug(`Instant update received via SSE`, { listId: data.listId });
						await this.pull(data.listId, { list: data.list, items: data.items });
					} else if (this.activeListIds.has(data.listId)) {
						syncLogger.debug(`Pulling ${data.listId} due to SSE update message`);
						await this.pull(data.listId);
					} else {
						this.reconcileAllLists();
					}
				}
			} catch (e) {
				syncLogger.error('SSE message parse error', {}, e);
			}
		};

		this.eventSource.onerror = (e) => {
			this.isOnline = false;
			syncLogger.warn('SSE connection lost. Browser will retry automatically.');
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
				syncLogger.error('Sync loop error', {}, e);
			}
			// Wait 10 seconds before next check (SSE handles real-time)
			await new Promise(resolve => setTimeout(resolve, 10000));
		}
	}

	async processQueue() {
		if (!this.isOnline) return;
		if (this.isSyncing) {
			syncLogger.debug('Sync already in progress, skipping...');
			return;
		}

		// Check if we have work to do before setting state
		const count = await db.syncQueue.count();
		if (count === 0) return;

		this.isSyncing = true;
		this.lastSyncError = null;

		const startTime = performance.now();
		syncLogger.info(`Pushing ${count} operations to server...`);

		try {
			const ops = await db.syncQueue.toArray();
			
			const fetchStart = performance.now();
			const response = await fetch('/api/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					operations: ops,
					clientId: this.clientId 
				})
			});
			const fetchDuration = (performance.now() - fetchStart).toFixed(2);

			if (!response.ok) {
				throw new Error(`Sync failed: ${response.statusText} (${response.status})`);
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
			const totalDuration = (performance.now() - startTime).toFixed(2);

			syncLogger.info(`Sync batch complete in ${totalDuration}ms (Network: ${fetchDuration}ms)`, {
				processed: successfulIds.length,
				failed: errors.length,
				remaining: count - successfulIds.length
			});

			if (errors.length > 0) {
				syncLogger.warn('Some operations failed to sync', { errors });
			}
		} catch (e) {
			const duration = (performance.now() - startTime).toFixed(2);
			syncLogger.error(`Sync failed after ${duration}ms`, { count }, e);
			this.lastSyncError = (e as Error).message;
			throw e;
		} finally {
			this.isSyncing = false;
			// If more items were added while we were syncing, process them immediately
			const remaining = await db.syncQueue.count();
			if (remaining > 0) {
				syncLogger.debug(`Found ${remaining} more items in queue, triggering next batch...`);
				setTimeout(() => this.processQueue(), 100);
			}
		}
	}

	async pull(listId: string, snapshot?: { list: any, items: any[] }) {
		const startTime = performance.now();
		try {
			let list, items;

			if (snapshot) {
				list = snapshot.list;
				items = snapshot.items;
				syncLogger.debug(`Reconciling ${listId} from SSE snapshot (no network fetch)`);
			} else {
				const fetchStart = performance.now();
				syncLogger.debug(`Pulling ${listId} via network...`);
				const response = await fetch(`/api/lists/${listId}`);
				const fetchDuration = (performance.now() - fetchStart).toFixed(2);

				if (!response.ok) return;
				const data = await response.json();
				list = data.list;
				items = data.items;
				syncLogger.debug(`Fetched ${listId} in ${fetchDuration}ms`);
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

			const totalDuration = (performance.now() - startTime).toFixed(2);
			syncLogger.info(`Local DB Update for ${listId} complete in ${totalDuration}ms`, { items: items.length });
		} catch (e) {
			const duration = (performance.now() - startTime).toFixed(2);
			syncLogger.error(`DB Update error for ${listId} after ${duration}ms`, {}, e);
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
			syncLogger.error('Reconcile all lists error', {}, e);
		} finally {
			this.isSyncing = false;
		}
	}

}

export const syncManager = new SyncManager();
