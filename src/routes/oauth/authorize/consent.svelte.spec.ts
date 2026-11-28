import { expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Consent from './+page.svelte';
import type { PageData } from './$types';
import '../../../app.css';

vi.mock('$app/paths', () => ({
	resolve: (path: string) => path,
	asset: (path: string) => path
}));

const data: PageData = {
	clientName: 'Claude',
	supabaseToken: undefined,
	sessionInvalid: undefined,
	signedIn: true,
	intent: 'test-intent',
	scopes: ['lists:read', 'proposals:create'],
	user: {
		id: 'test-user',
		email: 'alex@example.test',
		email_verified: true,
		createdAt: new Date()
	}
};

it('shows the configured client and requested scopes and submits the selected decision', async () => {
	await page.viewport(390, 720);
	render(Consent, { data });
	await expect.element(page.getByRole('heading', { name: 'Connect Claude to List' })).toBeVisible();
	await expect.element(page.getByText('alex@example.test')).toBeVisible();
	await expect.element(page.getByText('Read your lists')).toBeVisible();
	await expect.element(page.getByText('Suggest items')).toBeVisible();
	await expect.element(page.getByText('Stay connected')).not.toBeInTheDocument();

	const form = document.querySelector<HTMLFormElement>('.oauth-consent form')!;
	const decisions: FormData[] = [];
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		decisions.push(new FormData(form, (event as SubmitEvent).submitter));
	});
	await page.getByRole('button', { name: 'Allow access' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	expect(form.method).toBe('post');
	expect(decisions.map((body) => [body.get('intent'), body.get('decision')])).toEqual([
		['test-intent', 'allow'], ['test-intent', 'deny']
	]);
});

it('links back to the List sign-in flow when no account is connected', async () => {
	render(Consent, { data: { ...data, signedIn: false, intent: null, user: null } });
	await expect.element(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?oauth=1');
	await expect.element(page.getByRole('button', { name: 'Allow access' })).not.toBeInTheDocument();
});
