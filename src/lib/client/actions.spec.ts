import { afterEach, expect, it, vi } from 'vitest';
import { aiListAction } from './actions';
import { syncManager } from './sync.svelte';
import { world } from '$lib/test/fixtures';
import { listSchema } from '$lib/validations';

vi.mock('./sync.svelte', () => ({
	syncManager: {
		processQueue: vi.fn(async () => { throw new Error('Sync unavailable'); })
	}
}));

afterEach(() => vi.unstubAllGlobals());

it('revokes AI links when the normal sync queue is unavailable', async () => {
	const { id } = world.generate(listSchema);
	const fetch = vi.fn().mockResolvedValue(Response.json({ revoked: true }));
	vi.stubGlobal('fetch', fetch);

	await expect(aiListAction(id, 'DELETE')).resolves.toEqual({ revoked: true });
	expect(syncManager.processQueue).not.toHaveBeenCalled();
	expect(fetch).toHaveBeenCalledWith(
		`/api/lists/${encodeURIComponent(id)}/ai`,
		expect.objectContaining({ method: 'DELETE' })
	);
});
