import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { transpile, ModuleKind, ScriptTarget } from 'typescript';
import { expect, it } from 'vitest';

it('serves a public offline shell after an account switch in Chromium', async () => {
	const shell = readFileSync(new URL('../static/offline.html', import.meta.url), 'utf8');
	const offlineScript = readFileSync(new URL('../static/offline.js', import.meta.url), 'utf8');
	const worker = transpile(
		readFileSync(new URL('./service-worker.ts', import.meta.url), 'utf8')
			.replace("import { build, files, version } from '$service-worker';",
				"const build = ['/asset.js'], files = ['/offline.html', '/offline.js'], version = 'browser-test';"),
		{ module: ModuleKind.None, target: ScriptTarget.ESNext }
	);
	let networkDown = false;
	const server = createServer((request, response) => {
		if (networkDown) {
			request.socket.destroy();
			return;
		}
		const url = new URL(request.url ?? '/', 'http://localhost');
		if (url.pathname === '/service-worker.js') {
			response.writeHead(200, { 'content-type': 'text/javascript' }).end(worker);
			return;
		}
		if (url.pathname === '/offline.html') {
			response.writeHead(200, { 'content-type': 'text/html' }).end(shell);
			return;
		}
		if (url.pathname === '/offline.js') {
			response.writeHead(200, { 'content-type': 'text/javascript' }).end(offlineScript);
			return;
		}
		if (url.pathname === '/asset.js') {
			response.writeHead(200, { 'content-type': 'text/javascript' }).end('/* public asset */');
			return;
		}
		if (url.pathname === '/logout') {
			response.writeHead(200, { 'set-cookie': ['account=; Max-Age=0; Path=/', 'list_local_account=; Max-Age=0; Path=/'] }).end('Signed out');
			return;
		}
		if (url.pathname === '/login/b') {
			response.writeHead(200, { 'set-cookie': ['account=B; Path=/; HttpOnly', 'list_local_account=B; Path=/'] }).end('Signed in');
			return;
		}
		const account = request.headers.cookie?.match(/account=(A|B)/)?.[1] ?? 'guest';
		response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'private, no-store' })
			.end(`<main>Private account ${account}</main>`);
	});
	server.listen(0, '127.0.0.1');
	await once(server, 'listening');

	try {
		const address = server.address();
		if (!address || typeof address === 'string') throw new Error('Expected a TCP address');
		const origin = `http://127.0.0.1:${address.port}`;
		const browser = await chromium.launch();
		try {
			const context = await browser.newContext();
			context.setDefaultTimeout(5000);
			await context.addCookies([
				{ name: 'account', value: 'A', url: origin, httpOnly: true },
				{ name: 'list_local_account', value: 'A', url: origin }
			]);
			const page = await context.newPage();
			await page.goto(origin);
			await page.evaluate(async () => {
				for (const account of ['A', 'B', 'legacy']) {
					await new Promise<void>((resolve, reject) => {
						const request = indexedDB.open(account === 'legacy' ? 'ListAppDB' : `ListAppDB:account:${account}`, 1);
						request.onupgradeneeded = () => {
							const list = { id: 'groceries', slug: 'groceries', name: `Saved ${account}`, createdBy: account };
							const item = { id: 'item', listId: list.id, name: `Item ${account}`, rank: 1 };
							request.result.createObjectStore('lists', { keyPath: 'id' }).put(list);
							const items = request.result.createObjectStore('items', { keyPath: 'id' });
							items.createIndex('listId', 'listId');
							items.put(item);
						};
						request.onerror = () => reject(request.error);
						request.onsuccess = () => { request.result.close(); resolve(); };
					});
				}
				const oldCache = await caches.open('cache-legacy');
				await oldCache.put('/groceries', new Response('Private account A'));
				await navigator.serviceWorker.register('/service-worker.js');
			});
			await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

			await page.goto(`${origin}/groceries`);
			expect(await page.locator('main').textContent()).toBe('Private account A');
			await page.goto(`${origin}/logout`);
			await page.goto(`${origin}/login/b`);
			await page.goto(`${origin}/groceries`);
			expect(await page.locator('main').textContent()).toBe('Private account B');
			await page.evaluate(() => fetch('/groceries/__data.json'));

			const entries = await page.evaluate(async () => {
				const names = await caches.keys();
				return Object.fromEntries(await Promise.all(names.map(async (name) => {
					const cache = await caches.open(name);
					return [name, (await cache.keys()).map((request) => new URL(request.url).pathname).sort()];
				})));
			});
			expect(entries).toEqual({ 'list-public-browser-test': ['/asset.js', '/offline.html', '/offline.js'] });

			networkDown = true;
			const offline = await context.newPage();
			const result = await offline.goto(`${origin}/groceries`);
			expect(result?.status()).toBe(503);
			expect(await offline.locator('h1').textContent()).toBe('You’re offline');
			await offline.getByText('Saved B', { exact: true }).waitFor();
			expect(await offline.locator('main').textContent()).toContain('Item B');
			expect(await offline.locator('main').textContent()).not.toMatch(/Private account|Saved A|Item A|legacy/);
			expect(await offline.getByRole('link', { name: 'All saved lists' }).getAttribute('href')).toBe('/');
			expect((await offline.goto(origin))?.status()).toBe(503);
			await offline.getByRole('link', { name: 'Saved B' }).waitFor();
			expect(await offline.getByRole('link', { name: 'Saved B' }).getAttribute('href')).toBe('/groceries');

			networkDown = false;
			await page.goto(`${origin}/logout`);
			networkDown = true;
			const signedOut = await context.newPage();
			await signedOut.goto(`${origin}/groceries`);
			expect(await signedOut.locator('#offline-content').textContent()).toBe('');
			expect(await signedOut.locator('#offline-message').textContent()).toBe('Reconnect to open your lists.');
		} finally {
			await browser.close();
		}
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
}, 30_000);
