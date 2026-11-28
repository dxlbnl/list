import { beforeEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AiPanel from './AiPanel.svelte';
import { AiProposalConflict, AiProposalGroupConflict, decideAiProposal, getAiProposals } from '$lib/client/actions';
import { world } from '$lib/test/fixtures';
import { aiProposalSchema, listSchema } from '$lib/validations';
import '../../app.css';

vi.mock('$lib/client/actions', async (importOriginal) => ({
	...await importOriginal<typeof import('$lib/client/actions')>(),
	decideAiProposal: vi.fn(),
	getAiProposals: vi.fn()
}));
const list = world.generate(listSchema);
const proposal = aiProposalSchema.parse({
	id: 'proposal', listId: list.id, status: 'pending', version: 1, expiresAt: new Date(),
	items: [{ name: 'Melk', groupName: '' }, { name: 'Brood', groupName: 'Bakker' }]
});

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(getAiProposals).mockResolvedValue([proposal]);
});

it('keeps initial background errors out of the list', async () => {
	vi.mocked(getAiProposals).mockRejectedValueOnce(new Error('Network failed'));
	render(AiPanel, { listId: list.id });
	await expect.poll(() => vi.mocked(getAiProposals).mock.calls.length).toBe(1);
	await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
});

it('groups the items and allows an explicit replacement on a small screen', async () => {
	vi.mocked(decideAiProposal).mockRejectedValueOnce(new AiProposalGroupConflict(['Bakker'], ['Markt']))
		.mockResolvedValueOnce({ ...proposal, status: 'accepted', version: 2 });
	await page.viewport(390, 844);
	render(AiPanel, { listId: list.id });
	const general = page.getByRole('heading', { name: 'GENERAL' });
	await expect.element(general).toBeVisible();
	await expect.element(page.getByRole('heading', { name: 'Bakker' })).toBeVisible();
	const accept = page.getByRole('button', { name: 'Accept' });
	await accept.click();
	await expect.element(accept).toBeDisabled();
	await page.getByRole('combobox', { name: 'Bakker' }).selectOptions('Markt');
	await accept.click();
	expect(decideAiProposal).toHaveBeenLastCalledWith(list.id, proposal.id, {
		version: 1, decision: 'accepted', groupOverrides: [{ from: 'Bakker', to: 'Markt' }]
	});
	await expect.element(general).not.toBeInTheDocument();
});

it('refreshes a stale proposal and asks the member to review updated items', async () => {
	vi.mocked(decideAiProposal).mockRejectedValueOnce(new AiProposalConflict());
	vi.mocked(getAiProposals).mockResolvedValueOnce([proposal]).mockResolvedValueOnce([
		{ ...proposal, version: 2, items: [{ name: 'Havermelk', groupName: '' }] }
	]);
	render(AiPanel, { listId: list.id });
	await page.getByRole('button', { name: 'Accept' }).click();
	await expect.element(page.getByText('Havermelk', { exact: true })).toBeVisible();
	await expect.element(page.getByRole('alert')).toHaveTextContent('Review the updated items before deciding.');
});

it('defers polling while hidden or busy and preserves proposal feedback on resume', async () => {
	const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
	const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
	const setPolling = vi.spyOn(window, 'setInterval');
	const clearPolling = vi.spyOn(window, 'clearInterval');
	let rejectAction!: (error: Error) => void;
	vi.mocked(decideAiProposal).mockReturnValue(new Promise((_, reject) => { rejectAction = reject; }));
	const { unmount } = render(AiPanel, { listId: list.id });
	try {
		const timerIndex = setPolling.mock.calls.findIndex(([, delay]) => delay === 15000);
		expect(timerIndex).toBeGreaterThanOrEqual(0);
		const poll = setPolling.mock.calls[timerIndex][0] as () => void;
		poll();
		expect(getAiProposals).not.toHaveBeenCalled();
		visibility.mockReturnValue('visible');
		document.dispatchEvent(new Event('visibilitychange'));
		await page.getByRole('button', { name: 'Accept' }).click();

		poll();
		online.mockReturnValue(false);
		document.dispatchEvent(new Event('visibilitychange'));
		online.mockReturnValue(true);
		window.dispatchEvent(new Event('online'));
		expect(getAiProposals).toHaveBeenCalledTimes(1);

		rejectAction(new Error('Could not accept this proposal.'));
		await expect.element(page.getByRole('alert')).toHaveTextContent('Could not accept this proposal.');
		await expect.poll(() => vi.mocked(getAiProposals).mock.calls.length).toBe(2);

		await unmount();
		expect(clearPolling).toHaveBeenCalledWith(setPolling.mock.results[timerIndex].value);
		window.dispatchEvent(new Event('online'));
		document.dispatchEvent(new Event('visibilitychange'));
		expect(getAiProposals).toHaveBeenCalledTimes(2);
	} finally {
		visibility.mockRestore();
		online.mockRestore();
		setPolling.mockRestore();
		clearPolling.mockRestore();
	}
});
