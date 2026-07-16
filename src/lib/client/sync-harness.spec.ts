import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { users, lists, listUsers } from '$lib/server/db/schema';
import { syncRequestSchema } from '$lib/validations';
import { processSyncBatch } from '$lib/server/sync';
import { createTestDb, type TestDb } from '$lib/test/pglite';
import { ListDatabase } from '$lib/client/db';
import { createSyncManager } from './sync.svelte';

const LIST = 'list-shared';

/** A fetch that routes POST /api/sync to processSyncBatch on the shared pglite db, as `userId`. */
function apiSyncFetch(h: TestDb, userId: string): typeof fetch {
	return (async (_input: unknown, init: { body: string }) => {
		const parsed = syncRequestSchema.parse(JSON.parse(init.body));
		const out = await processSyncBatch(h.db, userId, parsed.operations, parsed.cursor);
		return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
	}) as unknown as typeof fetch;
}

describe('sync harness — two clients converge cross-device via the cursor delta', () => {
	let h: TestDb;
	afterEach(async () => {
		await h?.close();
	});

	it('client A pushes an item; client B pulls it (one round-trip each, no realtime)', async () => {
		h = await createTestDb();
		// A shared list both users belong to.
		await h.db.insert(users).values([{ id: 'A', email: null }, { id: 'B', email: null }]);
		await h.db.insert(lists).values({ id: LIST, slug: 'shared', name: 'Shared', createdBy: 'A', createdAt: new Date() });
		await h.db.insert(listUsers).values([{ listId: LIST, userId: 'A' }, { listId: LIST, userId: 'B' }]);

		const dbA = new ListDatabase(`A-${Math.random().toString(36).slice(2)}`);
		const dbB = new ListDatabase(`B-${Math.random().toString(36).slice(2)}`);
		const clientA = createSyncManager(dbA, apiSyncFetch(h, 'A'));
		const clientB = createSyncManager(dbB, apiSyncFetch(h, 'B'));

		// A creates an item locally + queues it, then pushes (one round-trip that also pulls).
		const item = { id: 'item-1', listId: LIST, name: 'Milk', groupName: '', rank: 1, done: false, deletedAt: null, updatedAt: new Date('2026-01-01T00:00:00.000Z') };
		await dbA.items.put(item);
		await dbA.syncQueue.add({ id: 'op-1', entity: 'item', type: 'INSERT', data: item, timestamp: 1 });
		await clientA.processQueue();

		// B has never seen it. One cursor pull and B converges — no realtime involved.
		let bRow = await dbB.items.get('item-1');
		expect(bRow).toBeUndefined();
		await clientB.pullDelta();
		bRow = await dbB.items.get('item-1');
		expect(bRow?.name).toBe('Milk');

		// A edits; B pulls again and only the delta since B's cursor arrives.
		const item2 = { ...item, name: 'Oat milk', updatedAt: new Date('2026-01-01T00:00:05.000Z') };
		await dbA.items.put(item2);
		await dbA.syncQueue.add({ id: 'op-2', entity: 'item', type: 'UPDATE', data: { id: 'item-1', name: 'Oat milk', updatedAt: item2.updatedAt }, timestamp: 2 });
		await clientA.processQueue();
		await clientB.pullDelta();
		bRow = await dbB.items.get('item-1');
		expect(bRow?.name).toBe('Oat milk');

		await dbA.delete();
		await dbB.delete();
	}, 30_000);
});
