import { expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import { handle, handleError } from './hooks.server';

vi.mock('$lib/server/auth', () => ({
	getSession: vi.fn(async () => ({ user: { id: 'user-id' }, session: { id: 'session-secret' } })),
	createAnonymousSession: vi.fn()
}));
vi.mock('$lib/server/supabase-auth', () => ({ createSupabaseToken: vi.fn() }));
vi.mock('$lib/server/logger', () => ({
	getAxiomClient: () => undefined,
	getAxiomDataset: () => undefined,
	flush: vi.fn()
}));

it.each([
	['/login/confirm/[token]', '/login/confirm/fixture-magic-token'],
	['/join/[slug]/[token]', '/join/groceries/fixture-invite-token']
])('uses the route ID when logging %s', async (id, pathname) => {
	const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
	const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
	try {
		const url = new URL(pathname, 'https://list.example.test');
		const event = {
			url, route: { id }, request: new Request(url), locals: {},
			cookies: { get: () => 'session-secret' }
		} as unknown as RequestEvent;
		await handle({ event, resolve: async () => new Response() });
		await handleError({ error: new Error(pathname), event, status: 500, message: 'Internal Error' });
		expect(info).toHaveBeenCalledWith(expect.stringContaining(id), expect.objectContaining({ path: id }));
		expect(error).toHaveBeenCalledWith(expect.stringContaining(id), expect.objectContaining({ path: id }));
		const logged = JSON.stringify([info.mock.calls, error.mock.calls]);
		expect(logged).not.toContain(pathname);
		expect(logged).not.toContain('session-secret');
	} finally {
		info.mockRestore();
		error.mockRestore();
	}
});
