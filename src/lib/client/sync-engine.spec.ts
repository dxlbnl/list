import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { ListDatabase } from '$lib/client/db';
import { createSyncManager } from './sync.svelte';

// A fresh, isolated Dexie per test (unique DB name) backed by fake-indexeddb.
function freshDb() {
	return new ListDatabase(`test-${Math.random().toString(36).slice(2)}`);
}

describe('SyncManager.applyServerItem — LWW apply guard (no resurrection)', () => {
	it('does not un-delete a locally soft-deleted item via a stale echo', async () => {
		const db = freshDb();
		const sm = createSyncManager(db);

		// Local: item soft-deleted at T1.
		const T1 = new Date('2026-01-01T00:00:01.000Z');
		await db.items.put({ id: 'item-1', listId: 'l1', name: 'Milk', groupName: '', rank: 1, done: false, deletedAt: T1, updatedAt: T1 });

		// A stale INSERT echo (the creation, T0 < T1, not deleted) arrives after the delete.
		const T0 = new Date('2026-01-01T00:00:00.000Z');
		await sm.applyServerItem({ id: 'item-1', listId: 'l1', name: 'Milk', groupName: '', rank: 1, done: false, deletedAt: null, updatedAt: T0 });

		const row = await db.items.get('item-1');
		expect(row?.deletedAt).toEqual(T1); // still deleted — not resurrected
		await db.delete();
	});

	it('applies a strictly newer server row', async () => {
		const db = freshDb();
		const sm = createSyncManager(db);
		const T0 = new Date('2026-01-01T00:00:00.000Z');
		await db.items.put({ id: 'item-2', listId: 'l1', name: 'Old', groupName: '', rank: 1, done: false, deletedAt: null, updatedAt: T0 });

		const T1 = new Date('2026-01-01T00:00:05.000Z');
		await sm.applyServerItem({ id: 'item-2', listId: 'l1', name: 'New', groupName: '', rank: 1, done: true, deletedAt: null, updatedAt: T1 });

		const row = await db.items.get('item-2');
		expect(row?.name).toBe('New');
		expect(row?.done).toBe(true);
		await db.delete();
	});

	it('lets a pending local op win over an incoming server row', async () => {
		const db = freshDb();
		const sm = createSyncManager(db);
		const T1 = new Date('2026-01-01T00:00:01.000Z');
		await db.items.put({ id: 'item-3', listId: 'l1', name: 'Local', groupName: '', rank: 1, done: false, deletedAt: null, updatedAt: T1 });
		await db.syncQueue.add({ id: 'op-x', entity: 'item', type: 'UPDATE', data: { id: 'item-3' }, timestamp: 1 });

		// Even a newer server row is skipped while a local op is in flight.
		const T2 = new Date('2026-01-01T00:00:09.000Z');
		await sm.applyServerItem({ id: 'item-3', listId: 'l1', name: 'Server', groupName: '', rank: 1, done: false, deletedAt: null, updatedAt: T2 });

		const row = await db.items.get('item-3');
		expect(row?.name).toBe('Local'); // pending in-flight wins
		await db.delete();
	});
});
