import { expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '$lib/test/pglite';
import { lists, magicLinks, users } from '$lib/server/db/schema';
import { world } from '$lib/test/fixtures';
import { listSchema } from '$lib/validations';
import { actions, load } from './+page.server';

const fixture = vi.hoisted(() => ({ db: undefined as Awaited<ReturnType<typeof createTestDb>>['db'] | undefined }));
vi.mock('$lib/server/db', () => ({ get db() { return fixture.db; } }));

it.each([
	{ scenario: 'anonymous source', email: null, sameAccount: false, merges: true },
	{ scenario: 'registered source', email: 'source@example.test', sameAccount: false, merges: false },
	{ scenario: 'same account', email: 'source@example.test', sameAccount: true, merges: false }
])('handles QR sign-in with $scenario', async ({ email, sameAccount, merges }) => {
	const h = await createTestDb();
	fixture.db = h.db;
	try {
		const list = world.generate(listSchema);
		const [source] = await h.db.insert(users).values({ id: list.createdBy, email }).returning();
		const targetId = sameAccount ? source.id : 'target-user';
		if (!sameAccount) await h.db.insert(users).values({ id: targetId, email: 'target@example.test' });
		await h.db.insert(lists).values(list);
		const token = 'test-qr-token';
		await h.db.insert(magicLinks).values({
			token, email: null, userIdToMerge: targetId,
			expiresAt: new Date(Date.now() + 60_000)
		});
		const event = { params: { token }, cookies: { set: vi.fn() }, locals: { user: source } };
		expect(await load(event as unknown as Parameters<typeof load>[0])).toMatchObject({
			switchingAccount: email !== null && !sameAccount
		});
		const confirm = actions.default!;
		await expect(Promise.resolve().then(() => confirm(event as unknown as Parameters<typeof confirm>[0])))
			.rejects.toMatchObject({ status: 303 });
		expect((await h.db.select().from(lists).where(eq(lists.id, list.id)))[0].createdBy)
			.toBe(merges ? targetId : source.id);
		expect(await h.db.select().from(users).where(eq(users.id, source.id)))
			.toHaveLength(merges ? 0 : 1);
	} finally {
		await h.close();
	}
}, 30_000);
