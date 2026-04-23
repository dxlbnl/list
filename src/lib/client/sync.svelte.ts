import { db, type LocalList, type LocalItem } from '$lib/client/db';
import { logger } from '$lib/logger';
import { supabase } from '$lib/client/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const syncLogger = logger.child({ module: 'client-sync' });

// Raw data from Supabase Realtime (Postgres snake_case)
interface RealtimeList {
	id: string;
	slug: string;
	name: string;
	created_by: string;
	created_at: string;
}

interface RealtimeItem {
	id: string;
	list_id: string;
	name: string;
	group_name: string | null;
	rank: number;
	done: boolean;
	deleted_at: string | null;
	updated_at: string;
}

// Data from our API (Drizzle camelCase)
interface ApiList {
	id: string;
	slug: string;
	name: string;
	createdBy: string;
	createdAt: string;
}

interface ApiItem {
	id: string;
	listId: string;
	name: string;
	groupName: string | null;
	rank: number;
	done: boolean;
	deletedAt: string | null;
	updatedAt: string;
}

interface SyncResult {
	id: string;
	status: 'success' | 'error';
	message?: string;
}

class SyncManager {
	isSyncing = $state(false);
	isOnline = $state(true);
	syncStatus = $state<'connected' | 'connecting' | 'disconnected'>('disconnected');
	lastSyncError = $state<string | null>(null);
	private channel: RealtimeChannel | null = null;
	private activeListIds = new Set<string>();
	private clientId = Math.random().toString(36).substring(7);
	private currentToken: string | null = null;

	constructor() {
		// Start sync loop
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;

			window.addEventListener('online', async () => {
				this.isOnline = true;
				syncLogger.info('Network online: triggering sync...');
				if (this.currentToken) this.connectSupabase(this.currentToken);

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
		}
	}

	/**
	 * Initialize the sync manager with a bridged Supabase JWT.
	 */
	init(token?: string) {
		if (!token) {
			this.syncStatus = 'disconnected';
			if (this.channel) {
				console.log("Unsubscribing from channel")
				this.channel.unsubscribe();
				this.channel = null;
			}
			return;
		}

		// Debug: Log the identity we are using
		try {
			const payload = JSON.parse(atob(token.split('.')[1]));
			syncLogger.info(`Realtime Identity: ${payload.sub}`);
		} catch (e) {
			syncLogger.error('Failed to decode JWT payload');
		}

		if (token === this.currentToken && this.syncStatus === 'connected') return;

		this.currentToken = token;
		this.connectSupabase(token);
	}

	private connectSupabase(token: string) {
		// Use a unique channel name per connection to avoid zombie state or naming collisions
		// when unsubscribing/resubscribing rapidly.
		const channelId = Math.random().toString(36).substring(7);
		if (this.channel) {
			console.log("Unsubscribing from channel")
			this.channel.unsubscribe();
		}

		syncLogger.info('Connecting to Supabase Realtime...', { channelId, token });
		this.syncStatus = 'connecting';

		// 1. Create the channel first
		this.channel = supabase.channel(`sync:${channelId}`);

		// 2. Set the bridged JWT immediately after creating the channel
		supabase.realtime.setAuth(token);

		// 3. Define listeners
		this.channel
			.on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
				console.log('REALTIME_EVENT_RECEIVED:', payload);
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'list_users' }, (payload) => {
				syncLogger.info('List membership change detected', { event: payload.eventType });
				this.reconcileAllLists();
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, async (payload: RealtimePostgresChangesPayload<RealtimeList>) => {
				let listId = ('id' in payload.new ? payload.new.id : null) ||
					('id' in payload.old ? payload.old.id : null);

				if (!listId) return;

				if (payload.eventType === 'DELETE') {
					syncLogger.info(`List ${listId} deleted on another device`);
					await db.lists.delete(listId);
					await db.items.where('listId').equals(listId).delete();
					this.reconcileAllLists();
				} else {
					syncLogger.debug(`List ${listId} updated metadata`);
					this.pull(listId);
				}
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, async (payload: RealtimePostgresChangesPayload<RealtimeItem>) => {
				let listId = ('list_id' in payload.new ? payload.new.list_id : null) ||
					('list_id' in payload.old ? payload.old.list_id : null);

				// Fallback: If REPLICA IDENTITY FULL is not set, DELETE payloads only have the PK (id)
				if (!listId && payload.eventType === 'DELETE' && 'id' in payload.old && payload.old.id) {
					const localItem = await db.items.get(payload.old.id);
					if (localItem) listId = localItem.listId;
				}

				if (listId) {
					syncLogger.debug(`Item change in list ${listId}`, { event: payload.eventType });
					this.pull(listId);
				}
			})
			.subscribe((status, err) => {
				this.isOnline = status === 'SUBSCRIBED';
				this.syncStatus = status === 'SUBSCRIBED' ? 'connected' : 'disconnected';

				if (status === 'SUBSCRIBED') {
					syncLogger.info('✅ Supabase Realtime connected');
				} else if (status === 'CHANNEL_ERROR') {
					syncLogger.error('❌ Realtime Channel Error', {
						message: err?.message || 'Subscription rejected',
						details: err,
						hint: 'Check RLS policies, Publication, and JWT Algorithm'
					});
				} else if (status === 'TIMED_OUT') {
					syncLogger.warn('⏳ Realtime connection timed out');
				} else {
					syncLogger.info(`Realtime status: ${status}`, { error: err });
				}
			});
	}

	subscribeToList(listId: string) {
		this.activeListIds.add(listId);
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

				const data: { results: SyncResult[] } = await response.json();
				const results = data.results;

				// Remove successfully processed ops from queue
				const successfulIds = results
					.filter((r) => r.status === 'success')
					.map((r) => r.id);

				if (successfulIds.length > 0) {
					await db.syncQueue.bulkDelete(successfulIds);
				}

				const errors = results.filter((r) => r.status === 'error');
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

	async pull(listId: string, snapshot?: { list: ApiList, items: ApiItem[] }) {
		if (this.activePulls.has(listId)) return this.activePulls.get(listId);

		const pullPromise = (async () => {
			this.isSyncing = true;
			const startTime = performance.now();
			try {
				let list: ApiList, items: ApiItem[];

				if (snapshot) {
					list = snapshot.list;
					items = snapshot.items;
					syncLogger.debug(`Reconciling ${listId} from snapshot (no network fetch)`);
				} else {
					const fetchStart = performance.now();
					syncLogger.debug(`Pulling ${listId} via network...`);
					const response = await fetch(`/api/lists/${listId}`);
					const fetchDuration = (performance.now() - fetchStart).toFixed(2);

					if (!response.ok) return;
					const data: { list: ApiList, items: ApiItem[] } = await response.json();
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
							id: list.id,
							slug: list.slug,
							name: list.name,
							createdBy: list.createdBy,
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

				const itemsToPut: LocalItem[] = [];
				const serverItemIds = new Set();

				for (const item of items) {
					serverItemIds.add(item.id);
					const localItem = localItemMap.get(item.id);
					const serverUpdatedAt = new Date(item.updatedAt);

					const isNewer = !localItem || serverUpdatedAt > new Date(localItem.updatedAt);

					if (!pendingItemIds.has(item.id) && isNewer) {
						itemsToPut.push({
							id: item.id,
							listId: item.listId,
							name: item.name,
							groupName: item.groupName || "",
							rank: item.rank,
							done: item.done,
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

				const data: { lists: ApiList[] } = await response.json();
				const lists = data.lists;
				const pendingListOps = await db.syncQueue.where('entity').equals('list').toArray();
				const pendingListIds = new Set(pendingListOps.map(op => op.entityId));

				const listsToPut: LocalList[] = [];
				for (const list of lists) {
					if (!pendingListIds.has(list.id)) {
						listsToPut.push({
							id: list.id,
							slug: list.slug,
							name: list.name,
							createdBy: list.createdBy,
							createdAt: new Date(list.createdAt)
						});
					}
				}
				if (listsToPut.length > 0) {
					await db.lists.bulkPut(listsToPut);
				}

				// Optional: Remove local lists that were deleted on server
				const serverListIds = new Set(lists.map((l) => l.id));
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
