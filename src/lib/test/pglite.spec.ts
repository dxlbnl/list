import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users, lists, items } from '$lib/server/db/schema';
import {
	itemDatabaseSchema,
	itemSchema,
	listDatabaseSchema,
	listSchema
} from '$lib/validations';
import { createTestDb, type TestDb } from './pglite';
import { world } from './fixtures';

describe('pglite harness', () => {
	let h: TestDb;

	afterEach(async () => {
		await h?.close();
	});

	it('boots the Drizzle schema and round-trips a coherent list+items graph', async () => {
		h = await createTestDb();

		// Native zod4-mock coherent-graph pattern: pin exactly one list in the
		// registry, then generate N items — each item's `listId` matcher
		// (registered in fixtures.ts) picks that list from the registry. No FK
		// stamping in test code.
		world.populate(listSchema, 1);
		const generatedItems = world.generate(z.array(itemSchema).length(2));
		const generatedList = world.registry.pick(listSchema);

		const listRow = listDatabaseSchema.parse(generatedList);
		const itemRows = generatedItems.map((i) => itemDatabaseSchema.parse(i));

		// Satisfy the lists.created_by FK with an owning user.
		await h.db.insert(users).values({ id: listRow.created_by, email: null });
		await h.db.insert(lists).values({
			id: listRow.id,
			slug: listRow.slug,
			name: listRow.name,
			createdBy: listRow.created_by,
			createdAt: new Date(listRow.created_at)
		});
		await h.db.insert(items).values(
			itemRows.map((r) => ({
				id: r.id,
				listId: r.list_id,
				name: r.name,
				groupName: r.group_name,
				rank: r.rank,
				done: r.done,
				deletedAt: r.deleted_at ? new Date(r.deleted_at) : null,
				updatedAt: new Date(r.updated_at)
			}))
		);

		const readList = await h.db.select().from(lists).where(eq(lists.id, listRow.id));
		expect(readList).toHaveLength(1);
		expect(readList[0].name).toBe(listRow.name);

		const readItems = await h.db.select().from(items).where(eq(items.listId, listRow.id));
		expect(readItems).toHaveLength(2);
	}, 30_000);
});
