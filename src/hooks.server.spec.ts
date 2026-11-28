import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ACCOUNT_CHANGED_HEADER, ACCOUNT_HEADER } from '$lib/account';
import type { RequestEvent } from '@sveltejs/kit';
import { chromium } from 'playwright';
import { expect, it, vi } from 'vitest';
import { handle } from './hooks.server';

vi.mock('$lib/server/auth', () => ({
	getSession: async () => ({ user: { id: 'browser-test' }, session: { id: 'session-test' } }),
	createAnonymousSession: vi.fn(),
	setLocalAccountCookie: vi.fn()
}));
vi.mock('$lib/server/supabase-auth', () => ({ createSupabaseToken: async () => undefined }));

it('accepts native same-origin forms and rejects a form from another origin', async () => {
	const form = (action: string) => `<form method="post" action="${action}"><button>Submit</button></form>`;
	const app = createServer(async (incoming, outgoing) => {
		try {
			const url = new URL(incoming.url!, `http://${incoming.headers.host}`);
			const request = new Request(url, { method: incoming.method, headers: incoming.headers as Record<string, string> });
			const event = { url, request, locals: {}, cookies: { get: () => undefined } } as unknown as RequestEvent;
			const response = await handle({
				event,
				resolve: async () => incoming.method === 'GET'
					? new Response(form(url.pathname), { headers: { 'content-type': 'text/html; charset=utf-8' } })
					: new Response('Form accepted')
			});
			outgoing.writeHead(response.status, Object.fromEntries(response.headers));
			outgoing.end(await response.text());
		} catch (cause) {
			outgoing.writeHead(500);
			outgoing.end(String(cause));
		}
	}).listen(0, '127.0.0.1');
	await once(app, 'listening');
	const origin = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
	const otherSite = createServer((_request, response) => {
		response.writeHead(200, { 'content-type': 'text/html' });
		response.end(form(origin + '/oauth/authorize'));
	}).listen(0, '127.0.0.1');
	await once(otherSite, 'listening');
	try {
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage();
			for (const path of ['/oauth/authorize', '/settings', '/login/confirm/example', '/logout']) {
				const pageResponse = await page.goto(origin + path);
				expect(pageResponse?.headers()['referrer-policy']).toBe('strict-origin');
				const posted = page.waitForResponse((response) => response.request().method() === 'POST');
				await page.getByRole('button', { name: 'Submit' }).click();
				const response = await posted;
				expect(response.status(), path).toBe(200);
				expect(await response.request().headerValue('referer')).toBe(origin + '/');
			}
			await page.goto(`http://127.0.0.1:${(otherSite.address() as AddressInfo).port}`);
			const posted = page.waitForResponse((response) => response.request().method() === 'POST');
			await page.getByRole('button', { name: 'Submit' }).click();
			expect((await posted).status()).toBe(403);
		} finally {
			await browser.close();
		}
	} finally {
		app.close();
		otherSite.close();
	}
}, 15000);


it('stops an old account’s request before routing it under the current session', async () => {
	const url = new URL('https://list.example/api/sync');
	const resolve = vi.fn();
	const event = {
		url,
		request: new Request(url, { headers: { [ACCOUNT_HEADER]: 'previous-browser-account' } }),
		locals: {},
		cookies: { get: () => undefined }
	} as unknown as RequestEvent;

	const response = await handle({ event, resolve });
	expect(response.status).toBe(409);
	expect(response.headers.get(ACCOUNT_CHANGED_HEADER)).toBe('1');
	expect(resolve).not.toHaveBeenCalled();
});
