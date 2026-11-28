import { expect, it, vi } from 'vitest';

vi.mock('$service-worker', () => ({
	build: ['/_app/entry.js'],
	files: ['/icon.svg'],
	version: 'fixture'
}));

it('evicts old caches and only intercepts public assets', async () => {
	const handlers = new Map<string, (event: unknown) => void>();
	const match = vi.fn(async () => new Response('public asset'));
	const remove = vi.fn(async () => true);
	vi.stubGlobal('self', {
		addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
		location: { origin: 'https://list.example.test' },
		clients: { claim: vi.fn() }
	});
	vi.stubGlobal('caches', {
		keys: async () => ['cache-old', 'list-public-fixture'],
		delete: remove,
		open: async () => ({ match })
	});
	try {
		await import('./service-worker');
		const waitUntil = vi.fn<(work: Promise<unknown>) => void>();
		handlers.get('activate')!({ waitUntil });
		await waitUntil.mock.calls[0][0];
		expect(remove.mock.calls).toEqual([['cache-old']]);

		const respondWith = vi.fn<(response: Promise<Response>) => void>();
		for (const path of ['/', '/my-list', '/my-list/__data.json', '/api/sync', '/login/confirm/token']) {
			handlers.get('fetch')!({ request: new Request(`https://list.example.test${path}`), respondWith });
		}
		expect(respondWith).not.toHaveBeenCalled();
		handlers.get('fetch')!({ request: new Request('https://list.example.test/icon.svg'), respondWith });
		expect(await (await respondWith.mock.calls[0][0]).text()).toBe('public asset');
		expect(match).toHaveBeenCalledWith('/icon.svg');
	} finally {
		vi.unstubAllGlobals();
	}
});
