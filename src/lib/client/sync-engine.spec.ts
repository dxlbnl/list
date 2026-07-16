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

describe('SyncManager invariants (characterisation / lock-down)', () => {
	it('pending-wins keys on the entity id (data.id), not the op id', async () => {
		const db = freshDb();
		const sm = createSyncManager(db);
		// op.id = "Y" (the operation's own nanoid), data.id = "X" (the entity).
		await db.syncQueue.add({ id: 'Y', entity: 'item', type: 'UPDATE', data: { id: 'X' }, timestamp: 1 });

		// X is pending (matches data.id) → even a far-future server row is NOT applied.
		await sm.applyServerItem({ id: 'X', listId: 'l', name: 's', groupName: '', rank: 1, done: false, deletedAt: null, updatedAt: new Date('2030-01-01') });
		expect(await db.items.get('X')).toBeUndefined();

		// Y is only an op.id, never a data.id → not pending → a server row IS applied.
		await sm.applyServerItem({ id: 'Y', listId: 'l', name: 's', groupName: '', rank: 1, done: false, deletedAt: null, updatedAt: new Date('2030-01-01') });
		expect(await db.items.get('Y')).toBeDefined();
		await db.delete();
	});

	it('reconcileAllLists fetches + applies even before a Supabase token is set (cold-link 404 fix)', async () => {
		const db = freshDb();
		const payload = [{ id: 'test', slug: 'test', name: 'Test', createdBy: 'u', createdAt: new Date().toISOString() }];
		const fetchFn = (async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
		const sm = createSyncManager(db, fetchFn);
		// No init()/token — currentToken is null; the reconcile must still run off the session cookie.
		await sm.reconcileAllLists();
		expect(await db.lists.get('test')).toBeDefined();
		await db.delete();
	});

	it('reconcile deletes locally-known lists absent from the server, but keeps isLocalOnly', async () => {
		const db = freshDb();
		const sm = createSyncManager(db);
		await db.lists.bulkPut([
			{ id: 'keep', slug: 'k', name: 'K', createdBy: 'u', createdAt: new Date() },
			{ id: 'local', slug: 'lo', name: 'L', createdBy: 'u', createdAt: new Date(), isLocalOnly: true },
			{ id: 'gone', slug: 'g', name: 'G', createdBy: 'u', createdAt: new Date() }
		]);

		await sm.reconcileWithServerLists([{ id: 'keep', slug: 'k', name: 'K', createdBy: 'u', createdAt: new Date().toISOString() }]);

		expect(await db.lists.get('keep')).toBeDefined();
		expect(await db.lists.get('local')).toBeDefined(); // isLocalOnly preserved
		expect(await db.lists.get('gone')).toBeUndefined(); // absent server-side → deleted
		await db.delete();
	});
});
