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
		const cookies = new Map([['auth_session', 'session-secret'], ['list_local_account', 'user-id']]);
		const event = {
			url, route: { id }, request: new Request(url), locals: {},
			cookies: { get: (name: string) => cookies.get(name) }
		} as unknown as RequestEvent;
		await handle({ event, resolve: async () => new Response() });
		await handleError({ error: new TypeError(pathname), event, status: 500, message: 'Internal Error' });
		expect(info).toHaveBeenCalledWith(expect.stringContaining(id), expect.objectContaining({ path: id }));
		expect(error).toHaveBeenCalledWith(expect.stringContaining(id),
			expect.objectContaining({ path: id, status: 500, errorKind: 'type_error' }));
		const logged = JSON.stringify([info.mock.calls, error.mock.calls]);
		expect(logged).not.toContain(pathname);
		expect(logged).not.toContain('session-secret');
	} finally {
		info.mockRestore();
		error.mockRestore();
	}
});

it.each(['/.well-known/oauth-authorization-server', '/oauth/authorize', '/oauth/token', '/mcp'])(
	'logs a safe request summary for %s',
	async (path) => {
		const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
		try {
			const url = new URL(path + '?code=private-query', 'https://list.example.test');
			const event = {
				url, route: { id: path }, locals: {},
				cookies: { get: () => undefined },
				request: new Request(url, { headers: { authorization: 'Bearer private-header' } })
			} as unknown as RequestEvent;
			const response = await handle({ event, resolve: async () => new Response(null, { status: 401 }) });
			expect(response.status).toBe(401);
			expect(info).toHaveBeenCalledWith('OAuth/MCP request', {
				method: 'GET', path, status: 401, duration: expect.any(Number)
			});
			expect(JSON.stringify(info.mock.calls)).not.toContain('private-');
		} finally {
			info.mockRestore();
		}
	}
);
