import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import AiPanel from './AiPanel.svelte';
import { aiListAction } from '$lib/client/actions';
import { world } from '$lib/test/fixtures';
import { listSchema } from '$lib/validations';
import '../../app.css';

vi.mock('$lib/client/actions', () => ({ aiListAction: vi.fn() }));
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
		const request = `Stel boodschappen voor. Lees ${location.origin}/api/ai/openapi.json en gebruik ${link}`;
		let connected = false;
		vi.mocked(aiListAction).mockImplementation(async (_id, method = 'GET') => {
			if (method === 'POST') { connected = true; return { url: link, request }; }
			if (method === 'DELETE') connected = false;
			return { proposals: [], links: connected ? [{ id: 'test-link' }] : [] };
		});
		await page.viewport(390, 844);
		render(AiPanel, { listId: list.id, open: true });
		await expect.element(page.getByRole('button', { name: 'Koppeling maken' })).toBeEnabled();
		await expect.element(page.getByRole('link', { name: 'OpenAPI-documentatie' })).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Koppeling maken' }).click();
		await page.getByRole('button', { name: 'Kopieer', exact: true }).click();
		expect(writeText).toHaveBeenCalledWith(request);
		await expect.element(page.getByRole('status')).toHaveTextContent('Het verzoek staat klaar om te plakken.');
		await page.getByRole('button', { name: 'Alle koppelingen intrekken' }).click();
		await expect.element(page.getByRole('textbox', { name: 'Geheime AI-koppeling' })).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Koppeling maken' })).toBeEnabled();
	});

	it('shows connection failures inside the open dialog and allows retrying', async () => {
		vi.mocked(aiListAction).mockImplementation(async (_id, method = 'GET') => {
			if (method === 'POST') throw new Error('Verbinding mislukt');
			return { proposals: [], links: [] };
		});
		render(AiPanel, { listId: list.id, open: true });
		await expect.element(page.getByRole('button', { name: 'Koppeling maken' })).toBeEnabled();
		await page.getByRole('button', { name: 'Koppeling maken' }).click();
		await expect.element(page.getByRole('dialog').getByRole('alert')).toHaveTextContent('Verbinding mislukt');
		await expect.element(page.getByRole('button', { name: 'Koppeling maken' })).toBeEnabled();
	});
});
