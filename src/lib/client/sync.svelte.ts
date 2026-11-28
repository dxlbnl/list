import { db, getLocalAccount, type QueuedSyncOperation, type ListDatabase, type LocalItem, type LocalList } from '$lib/client/db';
import { accountFetch } from './account-fetch';
import { logger } from '$lib/logger';
import { supabase } from '$lib/client/supabase';
import { observe as hlcObserve } from './hlc';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { MAX_SYNC_OPERATIONS, type DatabaseItem, type DatabaseList, type ApiItem, type ApiList } from '$lib/validations';

const syncLogger = logger.child({ module: 'client-sync' });

interface SyncResult {
	id: string | number;
	status: 'success' | 'ignored' | 'error';
	message?: string;
}

class SyncManager {
	private get db() { return this.database ?? db; }
	private get ready() { return this.database !== undefined || getLocalAccount() !== undefined; }
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
	private loadedCursor = false;
	private consecutiveFailures = 0;
	private retryPushAfter = 0;
	activePulls = $state<string[]>([]);

	constructor(private database?: ListDatabase, fetchFn: typeof fetch = accountFetch) {
		this.fetchFn = fetchFn;
		if (typeof window !== 'undefined') {
			this.isOnline = navigator.onLine;

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

	private loadCursor() {
		if (this.loadedCursor) return;
		this.loadedCursor = true;
		const account = getLocalAccount();
		if (!account || this.database) return;
		try {
			this.cursor = Number(localStorage.getItem(`syncCursor:${account}`)) || 0;
		} catch { /* Storage can be disabled. */ }
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
			const res = await this.fetchFn('/api/auth/token');
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
					await this.applyServerList({
						id: serverList.id,
						slug: serverList.slug,
						name: serverList.name,
						createdBy: serverList.created_by,
						createdAt: new Date(serverList.created_at)
					});
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
				// Cursor backfill ~every 10s (Realtime is the fast path; this only catches missed events).
				if (loopCount % 5 === 0) {
					await this.pullDelta();
				}
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
		return (await this.db.syncQueue.where('data.id').equals(entityId).first()) !== undefined;
	}

	/** Skip pending edits and stale server echoes, atomically with the local write. */
	async applyServerItem(candidate: LocalItem, pending?: Set<string>): Promise<void> {
		hlcObserve(candidate.updatedAt);
		await this.db.transaction('rw', this.db.syncQueue, this.db.items, async () => {
			if (pending ? pending.has(candidate.id) : await this.isOperationPending(candidate.id)) return;
			const local = await this.db.items.get(candidate.id);
			if (local && local.updatedAt >= candidate.updatedAt) return;
			await this.db.items.put(candidate);
		});
	}

	/** Apply a server list row while preserving pending local edits. */
	async applyServerList(candidate: LocalList, pending?: Set<string>): Promise<void> {
		await this.db.transaction('rw', this.db.syncQueue, this.db.lists, async () => {
			if (pending ? pending.has(candidate.id) : await this.isOperationPending(candidate.id)) return;
			await this.db.lists.put(candidate);
		});
	}

	/** Apply the cursor-delta `changes` (member-visible rows since our cursor) and advance the cursor. */
	private async applyChanges(
		changes: { items?: DatabaseItem[]; lists?: DatabaseList[] } | undefined,
		newCursor: number | undefined
	): Promise<void> {
		if (changes?.items?.length || changes?.lists?.length) {
			await this.db.transaction('rw', this.db.syncQueue, this.db.items, this.db.lists, async () => {
				const pending = new Set<string>(await this.db.syncQueue.orderBy('data.id').uniqueKeys() as string[]);
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
					}, pending);
				}
				for (const sl of changes?.lists ?? []) {
					await this.applyServerList({
						id: sl.id,
						slug: sl.slug,
						name: sl.name,
						createdBy: sl.created_by,
						createdAt: new Date(sl.created_at)
					}, pending);
				}
			});
		}
		if (typeof newCursor === 'number' && newCursor > this.cursor) {
			this.cursor = newCursor;
			try {
				const account = getLocalAccount();
				if (account && !this.database) localStorage.setItem(`syncCursor:${account}`, String(this.cursor));
			} catch { /* no localStorage */ }
		}
	}

	/** Idle / backfill pull: POST an empty batch with the cursor and apply what changed since. */
	async pullDelta(): Promise<void> {
		if (!this.ready) return;
		this.loadCursor();
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

	/**
	 * Reconcile the local list set against the server's authoritative view: delete
	 * locally-known lists that are absent server-side (unless `isLocalOnly`), then upsert the
	 * rest (pending local op wins). Extracted from reconcileAllLists so the deletes-absent
	 * invariant is unit-testable without auth/fetch.
	 */
	async reconcileWithServerLists(serverLists: ApiList[]): Promise<void> {
		const serverListIds = new Set(serverLists.map(l => l.id));
		const localLists = await this.db.lists.toArray();
		for (const list of localLists) {
			if (!serverListIds.has(list.id) && !list.isLocalOnly) {
				await this.db.lists.delete(list.id);
				await this.db.items.where('listId').equals(list.id).delete();
			}
		}
		for (const sl of serverLists) {
			await this.applyServerList({
				id: sl.id,
				slug: sl.slug,
				name: sl.name,
				createdBy: sl.createdBy,
				createdAt: new Date(sl.createdAt)
			});
		}
	}

	private async pushBatch(ops: QueuedSyncOperation[]): Promise<boolean> {
		const response = await this.fetchFn('/api/sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ operations: ops, clientId: this.clientId, cursor: this.cursor })
		});

		if (response.status === 400 || response.status === 422) {
			// Split only known input failures. Keep rejected records for inspection, but do not
			// send them again automatically or back off subsequent healthy writes.
			if (ops.length === 1) {
				const localId = ops[0].localId;
				if (localId === undefined) return false;
				await this.db.syncQueue.update(localId, {
					rejection: { status: response.status, rejectedAt: Date.now() }
				});
				return true;
			}
			const middle = Math.floor(ops.length / 2);
			const first = await this.pushBatch(ops.slice(0, middle));
			const second = await this.pushBatch(ops.slice(middle));
			return first && second;
		}
		if (!response.ok) throw new Error(`Sync failed: HTTP ${response.status}`);

		const data: { results: SyncResult[]; changes?: { items?: DatabaseItem[]; lists?: DatabaseList[] }; cursor?: number } = await response.json();
		const ackedIds = new Set(data.results.filter(r => r.status === 'success' || r.status === 'ignored').map(r => r.id));
		await this.db.syncQueue.bulkDelete(ops.flatMap(op =>
			op.localId !== undefined && ackedIds.has(op.id) ? [op.localId] : []
		));
		await this.applyChanges(data.changes, data.cursor);
		return ops.every(op => ackedIds.has(op.id));
	}

	async processQueue() {
		if (!this.ready || !this.isOnline || Date.now() < this.retryPushAfter) return;
		this.loadCursor();
		if (this.pushPromise) return this.pushPromise;

		this.pushPromise = (async () => {
			try {
				const pending = (op: QueuedSyncOperation) => !op.rejection;
				let batch = await this.db.syncQueue.filter(pending).limit(MAX_SYNC_OPERATIONS).toArray();
				if (batch.length > 0) this.isSyncing = true;
				let allAcknowledged = true;
				while (this.isOnline && batch.length > 0) {
					allAcknowledged = (await this.pushBatch(batch)) && allAcknowledged;
					const lastKey = batch.at(-1)?.localId;
					if (lastKey === undefined) break;
					batch = await this.db.syncQueue.where(':id').above(lastKey).and(pending).limit(MAX_SYNC_OPERATIONS).toArray();
				}
				if (!allAcknowledged) throw new Error('Some sync operations were not acknowledged.');
				const rejected = await this.db.syncQueue.filter((op) => Boolean(op.rejection)).first();
				this.lastSyncError = rejected ? 'Some sync operations were rejected and saved locally.' : null;
				this.consecutiveFailures = 0;
				this.retryPushAfter = 0;
			} catch (error) {
				this.consecutiveFailures++;
				this.retryPushAfter = Date.now() + Math.min(2000 * 2 ** this.consecutiveFailures, 30_000);
				this.lastSyncError = error instanceof Error ? error.message : String(error);
				syncLogger.error('Sync failed; unacknowledged operations remain queued', {}, error);
			} finally {
				this.pushPromise = null;
				if (this.activePulls.length === 0 && !this.reconcilePromise) this.isSyncing = false;
			}
		})();
		return this.pushPromise;
	}

	async reconcileAllLists() {
		if (!this.ready) return;
		// No currentToken (Supabase JWT) requirement: GET /api/lists authenticates via the session
		// cookie, so the [slug] load's miss-fallback can pull a just-opened/just-joined list even before
		// Realtime auth is ready. Requiring the token here caused a spurious 404 on direct/cold link opens.
		if (!this.isOnline) return;
		if (this.reconcilePromise) return this.reconcilePromise;

		this.reconcilePromise = (async () => {
			this.isSyncing = true;
			try {
				const res = await this.fetchFn('/api/lists');
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

				await this.reconcileWithServerLists(serverLists);
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
		if (!this.ready) return;
		if (this.activePulls.includes(listId)) return;
		this.activePulls.push(listId);
		this.isSyncing = true;
		try {
			const res = await this.fetchFn(`/api/lists/${listId}`);
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
