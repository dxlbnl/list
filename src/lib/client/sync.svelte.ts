import { db, type LocalList, type LocalItem } from '$lib/client/db';
import { logger } from '$lib/logger';
import { supabase } from '$lib/client/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { DatabaseItem, DatabaseList, ApiItem, ApiList } from '$lib/validations';

const syncLogger = logger.child({ module: 'client-sync' });

interface SyncResult {
	id: string | number;
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
	activePulls = $state<string[]>([]);

	constructor() {
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;

			window.addEventListener('online', async () => {
				this.isOnline = true;
				syncLogger.info('Network online: triggering sync...');
				if (this.currentToken) this.connectSupabase(this.currentToken);

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
					this.reconcileAllLists();
				}
			});

			this.startLoop();
		}
	}

	init(token?: string) {
		if (!token) {
			this.syncStatus = 'disconnected';
			if (this.channel) {
				this.channel.unsubscribe();
				this.channel = null;
			}
			return;
		}
		if (token === this.currentToken && this.syncStatus === 'connected') return;
		this.currentToken = token;
		this.connectSupabase(token);
		this.reconcileAllLists();
	}

	private connectSupabase(token: string) {
		const channelId = Math.random().toString(36).substring(7);
		if (this.channel) this.channel.unsubscribe();

		this.syncStatus = 'connecting';
		supabase.realtime.setAuth(token);
		this.channel = supabase.channel(`sync:${channelId}`);

		this.channel
			.on('postgres_changes', { event: '*', schema: 'public', table: 'list_users' }, (payload) => {
				syncLogger.info('Membership change detected', { event: payload.eventType });
				this.reconcileAllLists();
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, async (payload: RealtimePostgresChangesPayload<DatabaseList>) => {
				const listId = ('id' in payload.new ? payload.new.id : null) || ('id' in payload.old ? payload.old.id : null);
				if (!listId) return;

				if (payload.eventType === 'DELETE') {
					await db.lists.delete(listId);
					await db.items.where('listId').equals(listId).delete();
					this.reconcileAllLists();
				} else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
					const serverList = payload.new as DatabaseList;
					const isPending = await this.isOperationPending(listId);
					if (!isPending) {
						await db.lists.put({
							id: serverList.id,
							slug: serverList.slug,
							name: serverList.name,
							createdBy: serverList.created_by,
							createdAt: new Date(serverList.created_at)
						});
					} else {
						this.reconcileAllLists();
					}
				}
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, async (payload: RealtimePostgresChangesPayload<DatabaseItem>) => {
				const listId = ('list_id' in payload.new ? payload.new.list_id : null) || ('list_id' in payload.old ? payload.old.list_id : null);
				if (!listId || !this.activeListIds.has(listId)) return;

				if (payload.eventType === 'DELETE' && 'id' in payload.old) {
					await db.items.delete(payload.old.id as string);
				} else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
					const serverItem = payload.new as DatabaseItem;
					const isPending = await this.isOperationPending(serverItem.id);
					if (!isPending) {
						await db.items.put({
							id: serverItem.id,
							listId: serverItem.list_id,
							name: serverItem.name,
							groupName: serverItem.group_name || "",
							rank: serverItem.rank,
							done: serverItem.done,
							deletedAt: serverItem.deleted_at ? new Date(serverItem.deleted_at) : null,
							updatedAt: new Date(serverItem.updated_at)
						});
					} else {
						this.pull(listId);
					}
				}
			})
			.subscribe((status, err) => {
				this.isOnline = status === 'SUBSCRIBED';
				this.syncStatus = status === 'SUBSCRIBED' ? 'connected' : 'disconnected';
				if (status === 'CHANNEL_ERROR') {
					syncLogger.error('Realtime subscription error', { message: err?.message });
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
		let loopCount = 0;
		while (true) {
			try {
				await this.processQueue();
				// Reconcile all lists every 6 loops (~1 minute)
				if (loopCount % 6 === 0) {
					await this.reconcileAllLists();
				}
				loopCount++;
			} catch (e) {
				syncLogger.error('Sync loop error', {}, e);
			}
			await new Promise(resolve => setTimeout(resolve, 10000));
		}
	}

	private reconcilePromise: Promise<void> | null = null;
	private pushPromise: Promise<void> | null = null;

	private async isOperationPending(entityId: string) {
		const ops = await db.syncQueue.toArray();
		return ops.some(op => op.data.id === entityId);
	}

	async processQueue() {
		if (!this.isOnline) return;
		if (this.pushPromise) return this.pushPromise;

		const count = await db.syncQueue.count();
		if (count === 0) return;

		this.pushPromise = (async () => {
			this.isSyncing = true;
			this.lastSyncError = null;
			const startTime = performance.now();

			try {
				const ops = await db.syncQueue.toArray();
				const response = await fetch('/api/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ operations: ops, clientId: this.clientId })
				});

				if (response.status === 400) {
					const errorData = await response.json();
					syncLogger.error('Validation failed. Purging invalid batch.', { error: errorData });
					await db.syncQueue.bulkDelete(ops.map(o => o.localId).filter((id): id is number => id !== undefined));
					return;
				}

				if (!response.ok) throw new Error(`Sync failed: ${response.statusText}`);

				const data: { results: SyncResult[] } = await response.json();
				const successfulIds = new Set(data.results.filter(r => r.status === 'success').map(r => r.id));

				if (successfulIds.size > 0) {
					const localIdsToDelete = ops.filter(op => successfulIds.has(op.id)).map(op => op.localId).filter((id): id is number => id !== undefined);
					await db.syncQueue.bulkDelete(localIdsToDelete);
				}
			} catch (e) {
				syncLogger.error(`Sync failed`, { count }, e);
				this.lastSyncError = (e as Error).message;
				throw e;
			} finally {
				this.pushPromise = null;
				if (this.activePulls.length === 0 && !this.reconcilePromise) this.isSyncing = false;
				const remaining = await db.syncQueue.count();
				if (remaining > 0 && this.isOnline) setTimeout(() => this.processQueue(), 100);
			}
		})();

		return this.pushPromise;
	}

	async reconcileAllLists() {
		if (!this.isOnline || !this.currentToken) return;
		if (this.reconcilePromise) return this.reconcilePromise;

		this.reconcilePromise = (async () => {
			this.isSyncing = true;
			try {
				const res = await fetch('/api/lists');
				if (!res.ok) throw new Error(`Failed to fetch lists: ${res.statusText}`);
				
				const serverLists: ApiList[] = await res.json();
				if (!Array.isArray(serverLists)) {
					throw new Error('Expected array of lists from API');
				}

				const serverListIds = new Set(serverLists.map(l => l.id));

				const localLists = await db.lists.toArray();
				for (const list of localLists) {
					if (!serverListIds.has(list.id) && !list.isLocalOnly) {
						await db.lists.delete(list.id);
						await db.items.where('listId').equals(list.id).delete();
					}
				}

				for (const sl of serverLists) {
					const isPending = await this.isOperationPending(sl.id);
					if (!isPending) {
						await db.lists.put({
							id: sl.id,
							slug: sl.slug,
							name: sl.name,
							createdBy: sl.createdBy,
							createdAt: new Date(sl.createdAt)
						});
					}
				}
			} catch (e) {
				syncLogger.error('Reconciliation failed', {}, e);
			} finally {
				this.reconcilePromise = null;
				if (this.activePulls.length === 0) this.isSyncing = false;
			}
		})();
		return this.reconcilePromise;
	}

	async pull(listId: string) {
		if (this.activePulls.includes(listId)) return;
		this.activePulls.push(listId);
		this.isSyncing = true;
		try {
			const res = await fetch(`/api/lists/${listId}`);
			if (!res.ok) {
				if (res.status === 404) {
					await db.lists.delete(listId);
					await db.items.where('listId').equals(listId).delete();
				}
				return;
			}
			const data: { list: ApiList; items: ApiItem[] } = await res.json();
			for (const si of data.items) {
				const isPending = await this.isOperationPending(si.id);
				if (!isPending) {
					await db.items.put({
						id: si.id,
						listId: si.listId,
						name: si.name,
						groupName: si.groupName || "",
						rank: si.rank,
						done: si.done,
						deletedAt: si.deletedAt ? new Date(si.deletedAt) : null,
						updatedAt: new Date(si.updatedAt)
					});
				}
			}
		} finally {
			this.activePulls = this.activePulls.filter(id => id !== listId);
			if (this.activePulls.length === 0 && !this.reconcilePromise) this.isSyncing = false;
		}
	}
}

export const syncManager = new SyncManager();
