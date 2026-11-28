import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { transpile, ModuleKind, ScriptTarget } from 'typescript';
import { expect, it } from 'vitest';

it('serves a public offline shell after an account switch in Chromium', async () => {
	const shell = readFileSync(new URL('../static/offline.html', import.meta.url), 'utf8');
	const worker = transpile(
		readFileSync(new URL('./service-worker.ts', import.meta.url), 'utf8')
			.replace("import { build, files, version } from '$service-worker';",
				"const build = ['/asset.js'], files = ['/offline.html'], version = 'browser-test';"),
		{ module: ModuleKind.None, target: ScriptTarget.ESNext }
	);
	const server = createServer((request, response) => {
		const url = new URL(request.url ?? '/', 'http://localhost');
		if (url.pathname === '/service-worker.js') {
			response.writeHead(200, { 'content-type': 'text/javascript' }).end(worker);
			return;
		}
		if (url.pathname === '/offline.html') {
			response.writeHead(200, { 'content-type': 'text/html' }).end(shell);
			return;
		}
		if (url.pathname === '/asset.js') {
			response.writeHead(200, { 'content-type': 'text/javascript' }).end('/* public asset */');
			return;
		}
		if (url.pathname === '/logout') {
			response.writeHead(200, { 'set-cookie': 'account=; Max-Age=0; Path=/' }).end('Signed out');
			return;
		}
		if (url.pathname === '/login/b') {
			response.writeHead(200, { 'set-cookie': 'account=B; Path=/; HttpOnly' }).end('Signed in');
			return;
		}
		const account = request.headers.cookie?.match(/account=(A|B)/)?.[1] ?? 'guest';
		response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'private, max-age=3600' })
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
			await context.addCookies([{ name: 'account', value: 'A', url: origin, httpOnly: true }]);
			const page = await context.newPage();
			await page.goto(origin);
			await page.evaluate(async () => {
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
			expect(entries).toEqual({ 'list-public-browser-test': ['/asset.js', '/offline.html'] });

			await context.setOffline(true);
			const offline = await context.newPage();
			const result = await offline.goto(`${origin}/groceries`);
			expect(result?.status()).toBe(503);
			expect(await offline.locator('h1').textContent()).toBe('You’re offline');
			expect(await offline.locator('body').textContent()).not.toContain('Private account');
		} finally {
			await browser.close();
		}
	} finally {
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	}
}, 30_000);
