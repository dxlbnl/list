import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, lists, listUsers, items } from '$lib/server/db/schema';
import type { SyncOperation } from '$lib/validations';
import { createTestDb, type TestDb } from '$lib/test/pglite';
import { processSyncBatch } from './sync';

const USER = 'user-1';
const LIST = 'list-1';

/** Seed one user who owns + is a member of one list, so item upserts authorize. */
async function seedListMember(h: TestDb) {
	await h.db.insert(users).values({ id: USER, email: null });
	await h.db.insert(lists).values({ id: LIST, slug: 'groceries', name: 'Groceries', createdBy: USER, createdAt: new Date() });
	await h.db.insert(listUsers).values({ listId: LIST, userId: USER });
}

describe('processSyncBatch — same-id INSERT + UPDATE coalescing', () => {
	let h: TestDb;
	afterEach(async () => {
		await h?.close();
	});

	it('preserves the item when an INSERT and a later UPDATE for the same id batch together', async () => {
		h = await createTestDb();
		await seedListMember(h);

		const t1 = new Date('2026-01-01T00:00:00.000Z').toISOString();
		const t2 = new Date('2026-01-01T00:00:01.000Z').toISOString();

		// The real offline scenario: addItem then toggleDone before the first flush →
		// both ops in one batch. The UPDATE is a partial (only `done` + `updated_at`).
		const ops: SyncOperation[] = [
			{
				id: 'op-insert',
				entity: 'item',
				type: 'INSERT',
				data: { id: 'item-1', list_id: LIST, name: 'Milk', group_name: '', rank: 1, done: false, deleted_at: null, updated_at: t1 }
			},
			{
				id: 'op-update',
				entity: 'item',
				type: 'UPDATE',
				data: { id: 'item-1', done: true, updated_at: t2 }
			}
		];

		const { results } = await processSyncBatch(h.db, USER, ops);

		const rows = await h.db.select().from(items).where(eq(items.id, 'item-1'));
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe('Milk'); // mandatory field from the INSERT
		expect(rows[0].rank).toBe(1); // mandatory field from the INSERT
		expect(rows[0].done).toBe(true); // mutable field from the UPDATE
		expect(results.every((r) => r.status !== 'ignored')).toBe(true);
	}, 30_000);
});

describe('processSyncBatch — list INSERT authz (created_by cannot be spoofed)', () => {
	let h: TestDb;
	afterEach(async () => {
		await h?.close();
	});

	it('forces created_by to the authenticated user on a new-list INSERT', async () => {
		h = await createTestDb();
		const ATTACKER = 'attacker';
		const VICTIM = 'victim';
		await h.db.insert(users).values([
			{ id: ATTACKER, email: null },
			{ id: VICTIM, email: null }
		]);

		const ops: SyncOperation[] = [
			{
				id: 'op-1',
				entity: 'list',
				type: 'INSERT',
				data: { id: 'list-x', slug: 'mine', name: 'Mine', created_by: VICTIM, created_at: new Date('2026-01-01T00:00:00.000Z').toISOString() }
			}
		];

		await processSyncBatch(h.db, ATTACKER, ops);

		const rows = await h.db.select().from(lists).where(eq(lists.id, 'list-x'));
		expect(rows).toHaveLength(1);
		expect(rows[0].createdBy).toBe(ATTACKER); // not the spoofed VICTIM
	}, 30_000);
});
