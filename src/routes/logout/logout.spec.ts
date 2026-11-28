import { expect, it, vi } from 'vitest';
import { createTestDb } from '$lib/test/pglite';
import { users, sessions } from '$lib/server/db/schema';
import { getSession } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';
import { GET, POST } from './+server';

const fixture = vi.hoisted(() => ({ db: undefined as Awaited<ReturnType<typeof createTestDb>>['db'] | undefined }));
vi.mock('$lib/server/db', () => ({ get db() { return fixture.db; } }));

it('revokes the logged-out session and preserves other sessions', async () => {
	const h = await createTestDb();
	fixture.db = h.db;
	try {
		await h.db.insert(users).values({ id: 'logout-user' });
		await h.db.insert(sessions).values([
			{ id: 'current-session', userId: 'logout-user' },
			{ id: 'other-session', userId: 'logout-user' },
			{ id: 'ajax-session', userId: 'logout-user' }
		]);
		const event = (id: string, opts: { origin?: string; accept?: string } = {}) => {
			const url = new URL('https://list.example.test/logout');
			const request = new Request(url, {
				method: 'POST',
				headers: { origin: opts.origin ?? url.origin, accept: opts.accept ?? 'text/html' }
			});
			return { cookies: { get: () => id, delete: vi.fn() }, request, url } as unknown as RequestEvent;
		};
		const current = event('current-session');
		expect(await getSession(current)).toBeTruthy();

		const confirmation = await GET(current as Parameters<typeof GET>[0]);
		expect(confirmation.headers.get('cache-control')).toBe('no-store');
		expect(await confirmation.text()).toContain('<form method="post">');
		expect(current.cookies.delete).not.toHaveBeenCalled();
		expect(await getSession(current)).toBeTruthy();

		const wrongOrigin = event('current-session', { origin: 'https://other.example.test' });
		const forbidden = await POST(wrongOrigin as Parameters<typeof POST>[0]);
		expect(forbidden.status).toBe(403);
		expect(await getSession(current)).toBeTruthy();

		await expect(Promise.resolve().then(() => POST(current as Parameters<typeof POST>[0])))
			.rejects.toMatchObject({ status: 303, location: '/' });
		expect(current.cookies.delete).toHaveBeenCalledWith('auth_session', expect.objectContaining({ path: '/' }));
		expect(await getSession(current)).toBeNull();
		expect(await getSession(event('other-session'))).toBeTruthy();

		const ajax = event('ajax-session', { accept: 'application/json' });
		const result = await POST(ajax as Parameters<typeof POST>[0]);
		expect(result.status).toBe(204);
		expect(ajax.cookies.delete).toHaveBeenCalled();
		expect(await getSession(ajax)).toBeNull();
	} finally {
		await h.close();
	}
}, 30_000);
