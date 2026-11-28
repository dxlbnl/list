/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself
	...files  // everything in `static`
	// '/' is intentionally excluded: it returns auth-dependent HTML and must
	// always be fetched fresh from the network so the correct user is embedded.
];

worker.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache().then(() => worker.skipWaiting()));
});

worker.addEventListener('activate', (event) => {
	// Remove previous cached data from other screens
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches().then(() => worker.clients.claim()));
});

worker.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== worker.location.origin || !ASSETS.includes(url.pathname)) return;

	event.respondWith((async () => {
		const cache = await caches.open(CACHE);
		return (await cache.match(url.pathname)) ?? fetch(event.request);
	})());
});
