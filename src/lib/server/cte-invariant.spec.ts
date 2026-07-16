import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, lists, listUsers, items } from '$lib/server/db/schema';
import { syncOperationSchema, type SyncOperation } from '$lib/validations';
import { createTestDb, type TestDb } from '$lib/test/pglite';
import { processSyncBatch } from './sync';

const USER = 'u';
const LIST = 'l';
const T = (s: number) => new Date(`2026-01-01T00:00:0${s}.000Z`).toISOString();

async function seed(h: TestDb) {
	await h.db.insert(users).values({ id: USER, email: null });
	await h.db.insert(lists).values({ id: LIST, slug: 's', name: 'n', createdBy: USER, createdAt: new Date() });
	await h.db.insert(listUsers).values({ listId: LIST, userId: USER });
}
const insertItem = (): SyncOperation => ({
	id: 'i0', entity: 'item', type: 'INSERT',
	data: { id: 'x', list_id: LIST, name: 'Fresh', group_name: '', rank: 1, done: false, deleted_at: null, updated_at: T(2) }
});

describe('CTE invariants (characterisation / lock-down)', () => {
	let h: TestDb;
	afterEach(async () => {
		await h?.close();
		h = undefined as unknown as TestDb; // the pure-unit test below shares this hook — don't double-close
	});

	it('LWW: a stale UPDATE (older updated_at) is ignored, not applied', async () => {
		h = await createTestDb();
		await seed(h);
		await processSyncBatch(h.db, USER, [insertItem()]); // item at T2

		const { results } = await processSyncBatch(h.db, USER, [
			{ id: 'i1', entity: 'item', type: 'UPDATE', data: { id: 'x', name: 'Stale', updated_at: T(1) } }
		]);

		const row = (await h.db.select().from(items).where(eq(items.id, 'x')))[0];
		expect(row.name).toBe('Fresh'); // the stale write did not overwrite
		expect(results[0].status).toBe('ignored');
	}, 30_000);

	it('soft-delete preservation: a later UPDATE without deleted_at does not un-delete', async () => {
		h = await createTestDb();
		await seed(h);
		await processSyncBatch(h.db, USER, [{ id: 'i0', entity: 'item', type: 'INSERT', data: { id: 'x', list_id: LIST, name: 'M', group_name: '', rank: 1, done: false, deleted_at: null, updated_at: T(1) } }]);
		await processSyncBatch(h.db, USER, [{ id: 'i1', entity: 'item', type: 'UPDATE', data: { id: 'x', deleted_at: T(2), updated_at: T(2) } }]);
		// A later "tick done" carries no deleted_at — the CTE COALESCE must keep the row deleted.
		await processSyncBatch(h.db, USER, [{ id: 'i2', entity: 'item', type: 'UPDATE', data: { id: 'x', done: true, updated_at: T(3) } }]);

		const row = (await h.db.select().from(items).where(eq(items.id, 'x')))[0];
		expect(row.deletedAt).not.toBeNull(); // still deleted
		expect(row.done).toBe(true);
	}, 30_000);

	it('validator drops undefined fields on the wire (absent keys, not null)', () => {
		// Contract the INSERT+UPDATE coalesce relies on: a partial UPDATE serialises WITHOUT the
		// fields it doesn't touch (JSON.stringify omits undefined), so they arrive as absent → NULL.
		const op = syncOperationSchema.parse({ id: 'op', entity: 'item', type: 'UPDATE', data: { id: 'x', done: true, updatedAt: new Date('2026-01-01') } });
		const wire = JSON.parse(JSON.stringify(op.data));
		expect('list_id' in wire).toBe(false);
		expect('name' in wire).toBe(false);
		expect('rank' in wire).toBe(false);
		expect('group_name' in wire).toBe(false);
		expect(wire.id).toBe('x');
		expect(wire.done).toBe(true);
	});
});
