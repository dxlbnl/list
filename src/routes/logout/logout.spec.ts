import { expect, it, vi } from 'vitest';
import { createTestDb } from '$lib/test/pglite';
import { users, sessions } from '$lib/server/db/schema';
import { getSession } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { POST } from './+server';

const fixture = vi.hoisted(() => ({ db: undefined as Awaited<ReturnType<typeof createTestDb>>['db'] | undefined }));
vi.mock('$lib/server/db', () => ({ get db() { return fixture.db; } }));

it('revokes the logged-out session and preserves other sessions', async () => {
	const h = await createTestDb();
	fixture.db = h.db;
	try {
		await h.db.insert(users).values({ id: 'logout-user' });
		await h.db.insert(sessions).values([
			{ id: 'current-session', userId: 'logout-user' },
			{ id: 'other-session', userId: 'logout-user' }
		]);
		const event = (id: string) => ({ cookies: { get: () => id, delete: vi.fn() } } as unknown as RequestEvent);
		const current = event('current-session');
		expect(await getSession(current)).toBeTruthy();
		await expect(Promise.resolve().then(() => POST(current as Parameters<typeof POST>[0])))
			.rejects.toMatchObject({ status: 303, location: '/' });
		expect(current.cookies.delete).toHaveBeenCalledWith('auth_session', expect.objectContaining({ path: '/' }));
		expect(await getSession(current)).toBeNull();
		expect(await getSession(event('other-session'))).toBeTruthy();
	} finally {
		await h.close();
	}
}, 30_000);
