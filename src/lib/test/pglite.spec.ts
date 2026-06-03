import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { users, lists } from '$lib/server/db/schema';
import { listDatabaseSchema } from '$lib/validations';
import { createTestDb, type TestDb } from './pglite';
import { listFixture } from './fixtures';

describe('pglite harness', () => {
	let h: TestDb;

	afterEach(async () => {
		await h?.close();
	});

	it('boots the Drizzle schema and round-trips a fixture row', async () => {
		h = await createTestDb();


		// Same zod4-mock fixtures feed the DB: fixture → schema-validated row → insert.
		const fixture = listFixture();
		const row = listDatabaseSchema.parse(fixture);

		// Satisfy the lists.created_by FK with an owning user.
		await h.db.insert(users).values({ id: row.created_by, email: null });
		await h.db.insert(lists).values({
			id: row.id,
			slug: row.slug,
			name: row.name,
			createdBy: row.created_by,
			createdAt: new Date(row.created_at)
		});

		const read = await h.db.select().from(lists).where(eq(lists.id, row.id));
		expect(read).toHaveLength(1);
		expect(read[0].name).toBe(row.name);
	}, 30_000);
});
