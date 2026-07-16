import { db, type ListDatabase, type LocalItem, type LocalList } from '$lib/client/db';
import { logger } from '$lib/logger';
import { supabase } from '$lib/client/supabase';
import { observe as hlcObserve } from './hlc';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { DatabaseItem, DatabaseList, ApiItem, ApiList } from '$lib/validations';

const syncLogger = logger.child({ module: 'client-sync' });

interface SyncResult {
	id: string | number;
	status: 'success' | 'ignored' | 'error';
	message?: string;
}

class SyncManager {
	private db: ListDatabase;
	isSyncing = $state(false);
	isOnline = $state(true);
	syncStatus = $state<'connected' | 'connecting' | 'disconnected'>('disconnected');
	lastSyncError = $state<string | null>(null);
	private channel: RealtimeChannel | null = null;
	private activeListIds = new Set<string>();
	private clientId = Math.random().toString(36).substring(7);
	private currentToken: string | null = null;
	private tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	private isRefreshingToken = false;
	private fetchFn: typeof fetch;
	private cursor = 0;
	private consecutiveFailures = 0;
	activePulls = $state<string[]>([]);

	constructor(database: ListDatabase = db, fetchFn: typeof fetch = (...args) => fetch(...args)) {
		this.db = database;
		this.fetchFn = fetchFn;
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;
			try {
				const c = localStorage.getItem('syncCursor');
				if (c) this.cursor = Number(c) || 0;
			} catch { /* no localStorage */ }

			window.addEventListener('online', async () => {
				this.isOnline = true;
				syncLogger.info('Network online: triggering sync...');
				if (this.currentToken) this.connectSupabase(this.currentToken);

				await Promise.all([
					this.processQueue(),
					this.reconcileAllLists(),
					this.pullDelta()
				]);
			});

			window.addEventListener('offline', () => {
				this.isOnline = false;
				syncLogger.info('Network offline');
			});

			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible' && this.isOnline) {
					this.reconcileAllLists();
					this.pullDelta();
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
			if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
			this.currentToken = null;
			return;
		}
		if (token === this.currentToken && (this.syncStatus === 'connected' || this.syncStatus === 'connecting')) return;
		this.currentToken = token;
		this.scheduleTokenRefresh(token);
		this.connectSupabase(token);
		this.reconcileAllLists();
	}

	private getTokenExpiry(token: string): number | null {
		try {
			const payload = JSON.parse(atob(token.split('.')[1]));
			return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
		} catch {
			return null;
		}
	}

	private scheduleTokenRefresh(token: string) {
		if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);
		const expiry = this.getTokenExpiry(token);
		if (!expiry) return;
		// Refresh 5 minutes before expiry, or immediately if already close/past
		const delay = Math.max(0, expiry - Date.now() - 5 * 60 * 1000);
		this.tokenRefreshTimer = setTimeout(() => this.doTokenRefresh(), delay);
	}

	private async doTokenRefresh() {
		if (this.isRefreshingToken) return;
		this.isRefreshingToken = true;
		try {
			const res = await fetch('/api/auth/token');
			if (res.status === 401) {
				const { logout } = await import('$lib/client/auth');
				await logout();
				return;
			}
			if (!res.ok) return;
			const { token } = await res.json() as { token: string };
			if (token) this.init(token);
		} catch (e) {
			syncLogger.error('Token refresh failed', {}, e);
		} finally {
			this.isRefreshingToken = false;
		}
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
					await this.db.lists.delete(listId);
					await this.db.items.where('listId').equals(listId).delete();
					this.reconcileAllLists();
				} else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
					const serverList = payload.new as DatabaseList;
					const isPending = await this.isOperationPending(listId);
					if (!isPending) {
						await this.db.lists.put({
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
					await this.db.items.delete(payload.old.id as string);
				} else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
					const serverItem = payload.new as DatabaseItem;
					await this.applyServerItem({
						id: serverItem.id,
						listId: serverItem.list_id,
						name: serverItem.name,
						groupName: serverItem.group_name || "",
						rank: serverItem.rank,
						done: serverItem.done,
						deletedAt: serverItem.deleted_at ? new Date(serverItem.deleted_at) : null,
						updatedAt: new Date(serverItem.updated_at)
					});
				}
			})
			.subscribe((status, err) => {
				this.syncStatus = status === 'SUBSCRIBED' ? 'connected' : 'disconnected';
				if (status === 'CHANNEL_ERROR') {
					syncLogger.error('Realtime subscription error', { message: err?.message });
					if (err?.message && (err.message.includes('expired') || err.message.includes('InvalidJWT'))) {
						this.doTokenRefresh();
					}
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
		const BASE_MS = 2000;
		let backoffMs = BASE_MS;
		while (true) {
			try {
				await this.processQueue();
				await this.pullDelta(); // cursor backfill — reconverge items even if a realtime event was missed
				// Reconcile the authoritative list set (membership + hard deletes) ~every 60s.
				if (loopCount % 30 === 0) {
					await this.reconcileAllLists();
				}
				loopCount++;
				backoffMs = BASE_MS; // healthy cadence is decoupled from the error backoff
			} catch (e) {
				syncLogger.error('Sync loop error', {}, e);
				// Gentle incremental backoff capped at 30s — no 20s cliff on the first failure.
				backoffMs = Math.min(backoffMs * 2, 30000);
			}
			const jitter = Math.random() * 500;
			await new Promise(resolve => setTimeout(resolve, backoffMs + jitter));
		}
	}

	private reconcilePromise: Promise<void> | null = null;
	private pushPromise: Promise<void> | null = null;

	private async isOperationPending(entityId: string) {
		const ops = await this.db.syncQueue.toArray();
		return ops.some(op => op.data.id === entityId);
	}

	/**
	 * The single client apply path for a server item row — used by both the Realtime
	 * handler and pull. Last-write-wins guard: skip if a local op is still pending for this
	 * id, or if the local row is newer-or-equal than the incoming one. This is what stops a
	 * stale/reordered echo (e.g. an item's own delayed creation echo) from resurrecting a
	 * deleted item or reverting a newer field edit — the client apply path had no such guard.
	 */
	async applyServerItem(candidate: LocalItem): Promise<void> {
		hlcObserve(candidate.updatedAt); // keep our clock ahead of observed stamps
		if (await this.isOperationPending(candidate.id)) return; // local in-flight wins
		const local = await this.db.items.get(candidate.id);
		if (local && local.updatedAt >= candidate.updatedAt) return; // stale echo — drop it
		await this.db.items.put(candidate);
	}

	/** Apply a server list row (rename / new list from the cursor delta). Pending local op wins. */
	async applyServerList(candidate: LocalList): Promise<void> {
		if (await this.isOperationPending(candidate.id)) return;
		await this.db.lists.put(candidate);
	}

	/** Apply the cursor-delta `changes` (member-visible rows since our cursor) and advance the cursor. */
	private async applyChanges(
		changes: { items?: DatabaseItem[]; lists?: DatabaseList[] } | undefined,
		newCursor: number | undefined
	): Promise<void> {
		for (const si of changes?.items ?? []) {
			await this.applyServerItem({
				id: si.id,
				listId: si.list_id,
				name: si.name,
				groupName: si.group_name || "",
				rank: si.rank,
				done: si.done,
				deletedAt: si.deleted_at ? new Date(si.deleted_at) : null,
				updatedAt: new Date(si.updated_at)
			});
		}
		for (const sl of changes?.lists ?? []) {
			await this.applyServerList({
				id: sl.id,
				slug: sl.slug,
				name: sl.name,
				createdBy: sl.created_by,
				createdAt: new Date(sl.created_at)
			});
		}
		if (typeof newCursor === 'number' && newCursor > this.cursor) {
			this.cursor = newCursor;
			try {
				if (typeof localStorage !== 'undefined') localStorage.setItem('syncCursor', String(this.cursor));
			} catch { /* no localStorage */ }
		}
	}

	/** Idle / backfill pull: POST an empty batch with the cursor and apply what changed since. */
	async pullDelta(): Promise<void> {
		if (!this.isOnline) return;
		try {
			const res = await this.fetchFn('/api/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ operations: [], clientId: this.clientId, cursor: this.cursor })
			});
			if (!res.ok) return;
			const data: { changes?: { items?: DatabaseItem[]; lists?: DatabaseList[] }; cursor?: number } = await res.json();
			await this.applyChanges(data.changes, data.cursor);
		} catch (e) {
			syncLogger.error('pullDelta failed', {}, e);
		}
	}

	async processQueue() {
		if (!this.isOnline) return;
		if (this.pushPromise) return this.pushPromise;

		const count = await this.db.syncQueue.count();
		if (count === 0) return;

		this.pushPromise = (async () => {
			this.isSyncing = true;
			this.lastSyncError = null;

			try {
				const ops = await this.db.syncQueue.toArray();
				const response = await this.fetchFn('/api/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ operations: ops, clientId: this.clientId, cursor: this.cursor })
				});

				if (response.status === 400) {
					const errorData = await response.json();
					syncLogger.error('Validation failed. Batch rejected by server.', { error: errorData });
					// Drop the batch — a 400 means the client sent malformed data that will never succeed.
					// Individual ops are preserved if the cause was a transient schema mismatch.
					await this.db.syncQueue.bulkDelete(ops.map(o => o.localId).filter((id): id is number => id !== undefined));
					return;
				}

				if (response.status === 401 || response.status === 403) {
					syncLogger.error('Session expired or invalid. Logging out.');
					const { logout } = await import('$lib/client/auth');
					await logout();
					return;
				}

				if (!response.ok) throw new Error(`Sync failed: ${response.statusText}`);

				const data: { results: SyncResult[]; changes?: { items?: DatabaseItem[]; lists?: DatabaseList[] }; cursor?: number } = await response.json();
				// 'success' = written to DB; 'ignored' = rejected (auth/stale) — both are removed from queue.
				const ackedIds = new Set(data.results.filter(r => r.status === 'success' || r.status === 'ignored').map(r => r.id));

				if (ackedIds.size > 0) {
					const localIdsToDelete = ops.filter(op => ackedIds.has(op.id)).map(op => op.localId).filter((id): id is number => id !== undefined);
					await this.db.syncQueue.bulkDelete(localIdsToDelete);
				}

				// Fold the pull into the push response: apply changed rows + advance the cursor.
				await this.applyChanges(data.changes, data.cursor);
				this.consecutiveFailures = 0;
			} catch (e) {
				this.consecutiveFailures++;
				syncLogger.error(`Sync failed`, { count, consecutiveFailures: this.consecutiveFailures }, e);
				this.lastSyncError = (e as Error).message;
				// Poison-op quarantine: after repeated failures drop the wedged batch so other work can
				// flow instead of re-failing the same ops forever behind the backoff.
				if (this.consecutiveFailures >= 5) {
					const stuck = await this.db.syncQueue.toArray();
					syncLogger.warn('Quarantining batch after repeated sync failures', { count: stuck.length });
					await this.db.syncQueue.bulkDelete(stuck.map(o => o.localId).filter((id): id is number => id !== undefined));
					this.consecutiveFailures = 0;
					return;
				}
				throw e;
			} finally {
				this.pushPromise = null;
				if (this.activePulls.length === 0 && !this.reconcilePromise) this.isSyncing = false;
				const remaining = await this.db.syncQueue.count();
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
				if (res.status === 401 || res.status === 403) {
					syncLogger.error('Session expired or invalid during reconciliation. Logging out.');
					const { logout } = await import('$lib/client/auth');
					await logout();
					return;
				}
				if (!res.ok) throw new Error(`Failed to fetch lists: ${res.statusText}`);

				const serverLists: ApiList[] = await res.json();
				if (!Array.isArray(serverLists)) {
					throw new Error('Expected array of lists from API');
				}

				const serverListIds = new Set(serverLists.map(l => l.id));

				const localLists = await this.db.lists.toArray();
				for (const list of localLists) {
					if (!serverListIds.has(list.id) && !list.isLocalOnly) {
						await this.db.lists.delete(list.id);
						await this.db.items.where('listId').equals(list.id).delete();
					}
				}

				for (const sl of serverLists) {
					const isPending = await this.isOperationPending(sl.id);
					if (!isPending) {
						await this.db.lists.put({
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
			if (res.status === 401 || res.status === 403) {
				syncLogger.error('Session expired or invalid during pull. Logging out.');
				const { logout } = await import('$lib/client/auth');
				await logout();
				return;
			}
			if (!res.ok) {
				if (res.status === 404) {
					await this.db.lists.delete(listId);
					await this.db.items.where('listId').equals(listId).delete();
				}
				return;
			}
			const data: { list: ApiList; items?: ApiItem[] } = await res.json();
			for (const si of data.items ?? []) {
				await this.applyServerItem({
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
		} catch (e) {
			syncLogger.error(`Pull failed for list ${listId}`, {}, e);
		} finally {
			this.activePulls = this.activePulls.filter(id => id !== listId);
			if (this.activePulls.length === 0 && !this.reconcilePromise) this.isSyncing = false;
		}
	}
}

/** Factory for a fresh, isolated SyncManager (injectable Dexie) — used by the async test harness. */
export function createSyncManager(database?: ListDatabase, fetchFn?: typeof fetch) {
	return new SyncManager(database, fetchFn);
}

export const syncManager = new SyncManager();
