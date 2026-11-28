import { expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { lists, users } from '$lib/server/db/schema';
import { createTestDb } from '$lib/test/pglite';
import { world } from '$lib/test/fixtures';
import { listSchema, type ListOperationInput } from '$lib/validations';
import { POST } from './+server';

const database = vi.hoisted(() => ({ current: undefined as Awaited<ReturnType<typeof createTestDb>>['db'] | undefined }));
vi.mock('$lib/server/db', () => ({ get db() { return database.current; } }));

it('reports a permanent database input failure without committing the rest of the rejected batch', async () => {
	const h = await createTestDb();
	database.current = h.db;
	try {
		const list = world.generate(listSchema);
		const [user] = await h.db.insert(users).values({ id: list.createdBy }).returning();
		const valid: ListOperationInput = { id: 'valid', entity: 'list', type: 'INSERT', data: list };
		const invalid = { ...valid, id: 'invalid', data: { ...list, id: 'incomplete-list', name: undefined } };
		const send = (...operations: ListOperationInput[]) => POST({
			request: new Request('http://localhost/api/sync', {
				method: 'POST',
				body: JSON.stringify({ operations })
			}),
			locals: { user }
		} as unknown as Parameters<typeof POST>[0]);

		await expect(Promise.resolve().then(() => send(valid, invalid))).rejects.toMatchObject({ status: 422 });
		expect(await h.db.select().from(lists).where(eq(lists.id, list.id))).toHaveLength(0);
		expect((await send(valid)).status).toBe(200);
		expect(await h.db.select().from(lists).where(eq(lists.id, list.id))).toHaveLength(1);
	} finally {
		await h.close();
	}
}, 30_000);
