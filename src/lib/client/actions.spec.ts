import { afterEach, expect, it, vi } from 'vitest';
import { AiProposalGroupConflict, decideAiProposal, getAiProposals } from './actions';
import { syncManager } from './sync.svelte';
import { world } from '$lib/test/fixtures';
import { listSchema } from '$lib/validations';

vi.mock('./sync.svelte', () => ({ syncManager: { pullDelta: vi.fn(async () => {}) } }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('parses pending proposals and pulls sync only when the server confirms acceptance', async () => {
	const list = world.generate(listSchema);
	const proposal = {
		id: 'proposal', listId: list.id, version: 1, status: 'pending',
		expiresAt: new Date(), items: [{ name: 'Milk', groupName: '' }]
	};
	const fetch = vi.fn()
		.mockResolvedValueOnce(Response.json({ proposals: [proposal] }))
		.mockResolvedValueOnce(Response.json({ ...proposal, version: 2, status: 'accepted' }));
	vi.stubGlobal('fetch', fetch);
	await expect(getAiProposals(list.id)).resolves.toEqual([proposal]);
	await expect(decideAiProposal(list.id, proposal.id, { version: 1, decision: 'accepted' }))
		.resolves.toMatchObject({ status: 'accepted' });
	expect(syncManager.pullDelta).toHaveBeenCalledOnce();
});

it('returns replacement options without syncing when a group changed', async () => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
		Response.json({ code: 'GROUP_CHANGED', missingGroups: ['old'], groups: ['new'] }, { status: 409 })
	));
	await expect(decideAiProposal('list', 'proposal', { version: 1, decision: 'accepted' }))
		.rejects.toBeInstanceOf(AiProposalGroupConflict);
	expect(syncManager.pullDelta).not.toHaveBeenCalled();
});
