import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AiPanel from './AiPanel.svelte';
import { aiListAction, AiProposalConflict } from '$lib/client/actions';
import { world } from '$lib/test/fixtures';
import { aiProposalSchema, listSchema } from '$lib/validations';
import '../../app.css';

vi.mock('$lib/client/actions', () => ({
	aiListAction: vi.fn(),
	AiProposalConflict: class extends Error {}
}));
const list = world.generate(listSchema);

beforeEach(() => {
	vi.mocked(aiListAction).mockReset();
	vi.mocked(aiListAction).mockResolvedValue({ proposals: [], links: [] });
	document.documentElement.dataset.theme = 'dark';
});
afterEach(() => vi.restoreAllMocks());

describe('AI connection dialog', () => {
	it('copies a complete agent request and removes the secret after revocation', async () => {
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
		const link = `${location.origin}/api/ai/connect#token=test-only`;
		const request = `Suggest groceries. Read ${location.origin}/api/ai/openapi.json and use ${link}`;
		let connected = false;
		vi.mocked(aiListAction).mockImplementation(async (_id, method = 'GET') => {
			if (method === 'POST') { connected = true; return { url: link, request }; }
			if (method === 'DELETE') connected = false;
			return { proposals: [], links: connected ? [{ id: 'test-link' }] : [] };
		});
		await page.viewport(390, 844);
		render(AiPanel, { listId: list.id, open: true });
		await expect.element(page.getByRole('button', { name: 'Create AI link' })).toBeEnabled();
		await expect.element(page.getByRole('link', { name: 'OpenAPI documentation' })).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Create AI link' }).click();
		await page.getByRole('button', { name: 'Copy AI request', exact: true }).click();
		expect(writeText).toHaveBeenCalledWith(request);
		await expect.element(page.getByRole('status')).toHaveTextContent('The request is ready to paste.');
		await page.getByRole('button', { name: 'Revoke all AI links' }).click();
		await expect.element(page.getByRole('textbox', { name: 'Secret AI link' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Create AI link' })).toBeEnabled();
	});

	it('shows connection failures inside the open dialog and allows retrying', async () => {
		vi.mocked(aiListAction).mockImplementation(async (_id, method = 'GET') => {
			if (method === 'POST') throw new Error('Connection failed');
			return { proposals: [], links: [] };
		});
		render(AiPanel, { listId: list.id, open: true });
		await expect.element(page.getByRole('button', { name: 'Create AI link' })).toBeEnabled();
		await page.getByRole('button', { name: 'Create AI link' }).click();
		await expect.element(page.getByRole('dialog').getByRole('alert')).toHaveTextContent('Connection failed');
		await expect.element(page.getByRole('button', { name: 'Create AI link' })).toBeEnabled();
	});
});

it('refreshes a stale proposal and asks the member to review the updated items', async () => {
	const proposal = world.generate(aiProposalSchema, {
		overrides: { status: 'pending', version: 1, items: [{ name: 'Milk', groupName: '' }] }
	});
	let updated = false;
	vi.mocked(aiListAction).mockImplementation(async (_id, method = 'GET') => {
		if (method === 'POST') {
			updated = true;
			throw new AiProposalConflict();
		}
		return {
			proposals: [updated ? { ...proposal, version: 2, items: [{ name: 'Oat milk', groupName: '' }] } : proposal],
			links: []
		};
	});

	render(AiPanel, { listId: list.id });
	await expect.element(page.getByText('Milk', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Accept', exact: true }).click();
	await expect.element(page.getByText('Oat milk', { exact: true })).toBeVisible();
	await expect.element(page.getByRole('alert')).toHaveTextContent('Review the updated items before deciding.');
});


it('polls only while visible and online and detaches listeners on unmount', async () => {
	const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
	const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
	const { unmount } = render(AiPanel, { listId: list.id });
	expect(aiListAction).not.toHaveBeenCalled();

	visibility.mockReturnValue('visible');
	document.dispatchEvent(new Event('visibilitychange'));
	await expect.poll(() => vi.mocked(aiListAction).mock.calls.length).toBe(1);

	online.mockReturnValue(false);
	document.dispatchEvent(new Event('visibilitychange'));
	expect(aiListAction).toHaveBeenCalledTimes(1);
	online.mockReturnValue(true);
	window.dispatchEvent(new Event('online'));
	await expect.poll(() => vi.mocked(aiListAction).mock.calls.length).toBe(2);

	await unmount();
	window.dispatchEvent(new Event('online'));
	document.dispatchEvent(new Event('visibilitychange'));
	expect(aiListAction).toHaveBeenCalledTimes(2);
});
