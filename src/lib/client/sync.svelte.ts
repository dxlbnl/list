import { db } from '$lib/client/db';
import { logger } from '$lib/logger';

const syncLogger = logger.child({ module: 'client-sync' });

class SyncManager {
	isSyncing = $state(false);
	isOnline = $state(true);
	sseStatus = $state<'connected' | 'connecting' | 'disconnected'>('connecting');
	lastSyncError = $state<string | null>(null);
	private eventSource: EventSource | null = null;
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

			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible' && this.isOnline) {
					syncLogger.debug('Visibility changed: reconciling all lists');
					this.reconcileAllLists();
				}
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
			this.sseStatus = 'connected';
			this.lastSyncError = null;
		};

		this.eventSource.onmessage = async (event) => {
			this.isOnline = true;
			try {
				const data = JSON.parse(event.data);
				// Support both "update" type and any message with listId/deleted
				if ((data.type === 'update' || data.deleted || data.listId === 'global') && data.listId) {
					if (data.listId === 'global') {
						syncLogger.info('Global refresh triggered via SSE');
						this.reconcileAllLists();
					} else if (data.deleted) {
						syncLogger.info(`List ${data.listId} deleted on another device, removing locally`);
						await db.lists.delete(data.listId);
						await db.items.where('listId').equals(data.listId).delete();
						// Trigger reconcile to clean up dashboard
						this.reconcileAllLists();
					} else if (data.list && data.items) {
						syncLogger.debug(`Instant update for list ${data.listId} received via SSE`);
						await this.pull(data.listId, { list: data.list, items: data.items });
					} else if (this.activePulls.has(data.listId) || this.activeListIds.has(data.listId)) {
						syncLogger.debug(`Refreshing list ${data.listId} due to SSE message`);
						await this.pull(data.listId);
					} else {
						// Fallback: something changed in a list we have but aren't currently viewing
						this.reconcileAllLists();
					}
				}
			} catch (e) {
				syncLogger.error('SSE message parse error', {}, e);
			}
		};

		this.eventSource.onerror = (e) => {
			this.isOnline = false;
			this.sseStatus = 'disconnected';
			this.lastSyncError = "Live sync connection lost. Browser will retry automatically.";
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

	private reconcilePromise: Promise<void> | null = null;
	private pushPromise: Promise<void> | null = null;

	async processQueue() {
		if (!this.isOnline) return;
		if (this.pushPromise) return this.pushPromise;

		const count = await db.syncQueue.count();
		if (count === 0) return;

		this.pushPromise = (async () => {
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
				this.pushPromise = null;
				// Only reset isSyncing if no other pulls or reconciliations are active
				if (this.activePulls.size === 0 && !this.reconcilePromise) {
					this.isSyncing = false;
				}
				
				// If more items were added while we were syncing, process them immediately
				const remaining = await db.syncQueue.count();
				if (remaining > 0) {
					syncLogger.debug(`Found ${remaining} more items in queue, triggering next batch...`);
					setTimeout(() => this.processQueue(), 100);
				}
			}
		})();

		return this.pushPromise;
	}

	private activePulls = new Map<string, Promise<void>>();

	async pull(listId: string, snapshot?: { list: any, items: any[] }) {
		if (this.activePulls.has(listId)) return this.activePulls.get(listId);

		const pullPromise = (async () => {
			this.isSyncing = true;
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

				// Fetch all local items for this list once to avoid O(N) queries
				const localItems = await db.items.where('listId').equals(listId).toArray();
				const localItemMap = new Map(localItems.map(i => [i.id, i]));
				
				const itemsToPut: any[] = [];
				const serverItemIds = new Set();

				for (const item of items) {
					serverItemIds.add(item.id);
					const localItem = localItemMap.get(item.id);
					const serverUpdatedAt = new Date(item.updatedAt);
					
					const isNewer = !localItem || serverUpdatedAt > new Date(localItem.updatedAt);

					if (!pendingItemIds.has(item.id) && isNewer) {
						itemsToPut.push({
							...item,
							groupName: item.groupName || "",
							deletedAt: item.deletedAt ? new Date(item.deletedAt) : null,
							updatedAt: serverUpdatedAt
						});
					}
				}

				if (itemsToPut.length > 0) {
					await db.items.bulkPut(itemsToPut);
				}

				// Handle deleted items that are gone from server
				const idsToDelete: string[] = [];
				for (const localItem of localItems) {
					if (!serverItemIds.has(localItem.id) && !pendingItemIds.has(localItem.id)) {
						idsToDelete.push(localItem.id);
					}
				}
				
				if (idsToDelete.length > 0) {
					await db.items.bulkDelete(idsToDelete);
				}

				const totalDuration = (performance.now() - startTime).toFixed(2);
				syncLogger.info(`Local DB Update for ${listId} complete in ${totalDuration}ms`, { items: items.length });
			} catch (e) {
				const duration = (performance.now() - startTime).toFixed(2);
				syncLogger.error(`DB Update error for ${listId} after ${duration}ms`, {}, e);
			} finally {
				this.activePulls.delete(listId);
				// Only reset isSyncing if no other pulls or pushes are active
				if (this.activePulls.size === 0 && !this.reconcilePromise && !this.pushPromise) {
					this.isSyncing = false;
				}
			}
		})();

		this.activePulls.set(listId, pullPromise);
		return pullPromise;
	}

	async reconcileAllLists() {
		if (!this.isOnline) return;
		if (this.reconcilePromise) return this.reconcilePromise;

		this.reconcilePromise = (async () => {
			this.isSyncing = true;
			try {
				const response = await fetch('/api/lists');
				if (!response.ok) return;

				const { lists } = await response.json();
				const pendingListOps = await db.syncQueue.where('entity').equals('list').toArray();
				const pendingListIds = new Set(pendingListOps.map(op => op.entityId));

				const listsToPut: any[] = [];
				for (const list of lists) {
					if (!pendingListIds.has(list.id)) {
						listsToPut.push({
							...list,
							createdAt: new Date(list.createdAt)
						});
					}
				}
				if (listsToPut.length > 0) {
					await db.lists.bulkPut(listsToPut);
				}

				// Optional: Remove local lists that were deleted on server
				const serverListIds = new Set(lists.map((l: any) => l.id));
				const localLists = await db.lists.toArray();
				const listIdsToDelete: string[] = [];

				for (const localList of localLists) {
					if (!serverListIds.has(localList.id) && !pendingListIds.has(localList.id) && !localList.isLocalOnly) {
						listIdsToDelete.push(localList.id);
					}
				}

				if (listIdsToDelete.length > 0) {
					await db.lists.bulkDelete(listIdsToDelete);
					// Bulk delete all items belonging to any of the deleted lists in one query
					await db.items.where('listId').anyOf(listIdsToDelete).delete();
				}
			} catch (e) {
				syncLogger.error('Reconcile all lists error', {}, e);
			} finally {
				this.reconcilePromise = null;
				// Only reset isSyncing if no other pulls or pushes are active
				if (this.activePulls.size === 0 && !this.pushPromise) {
					this.isSyncing = false;
				}
			}
		})();

		return this.reconcilePromise;
	}

}

export const syncManager = new SyncManager();
