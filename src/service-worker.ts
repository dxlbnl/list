/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `list-public-${version}`;
const OFFLINE_PAGE = '/offline.html';
const ASSETS = new Set([...build, ...files, OFFLINE_PAGE, '/offline.js']);
const NON_LIST_ROUTES = new Set(['api', 'join', 'login', 'logout', 'mcp', 'oauth', 'settings']);

worker.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll([...ASSETS]);
	}

	event.waitUntil(addFilesToCache().then(() => worker.skipWaiting()));
});

worker.addEventListener('activate', (event) => {
	// Remove previous cached data from other screens
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE && (key.startsWith('list-public-') || key.startsWith('cache-'))) {
				await caches.delete(key);
			}
		}
	}

	event.waitUntil(deleteOldCaches().then(() => worker.clients.claim()));
});

worker.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== worker.location.origin) return;

	if (ASSETS.has(url.pathname)) {
		event.respondWith((async () => {
			const cache = await caches.open(CACHE);
			return (await cache.match(url.pathname)) ?? fetch(request);
		})());
		return;
	}

	// Only list-page navigations use the public shell. API, auth, and paginadata
	// keep their normal network behavior and are never written to Cache Storage.
	const slug = url.pathname.replace(/^\/|\/$/g, '');
	if (request.mode !== 'navigate' || slug.includes('/') || slug.includes('.') || NON_LIST_ROUTES.has(slug)) return;

	event.respondWith((async () => {
		try {
			return await fetch(request, { cache: 'no-store' });
		} catch {
			const cache = await caches.open(CACHE);
			const shell = await cache.match(OFFLINE_PAGE);
			return shell
				? new Response(shell.body, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
				: Response.error();
		}
	})());
});
