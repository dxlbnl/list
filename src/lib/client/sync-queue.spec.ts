import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { ListDatabase } from './db';
import { createSyncManager } from './sync.svelte';
import { listSchema, MAX_SYNC_OPERATIONS, syncRequestSchema } from '$lib/validations';
import { world } from '$lib/test/fixtures';

it('retains the queue through repeated transient failures and drains bounded batches', async () => {
	const db = new ListDatabase('durable-queue-test');
	const list = world.generate(listSchema);
	const batchSizes: number[] = [];
	const clock = vi.spyOn(Date, 'now');
	let now = Date.now();
	clock.mockImplementation(() => now);
	let fail = true;
	const enqueue = (id: number) => db.syncQueue.add({ id, type: 'DELETE', entity: 'list', data: { id: list.id } });
	const manager = createSyncManager(db, async (_url, init) => {
		const { operations } = syncRequestSchema.parse(JSON.parse(String(init?.body)));
		batchSizes.push(operations.length);
		if (fail) {
			if (batchSizes.length === 1) await enqueue(MAX_SYNC_OPERATIONS + 1);
			return new Response(null, { status: 503 });
		}
		return Response.json({ results: operations.map(({ id }) => ({ id, status: 'success' })) });
	});
	try {
		for (let i = 0; i <= MAX_SYNC_OPERATIONS; i++) await enqueue(i);
		for (let i = 0; i < 5; i++) {
			await manager.processQueue();
			now += 31_000;
		}
		expect(await db.syncQueue.count()).toBe(MAX_SYNC_OPERATIONS + 2);
		fail = false;
		await manager.processQueue();
		expect(batchSizes).toEqual([...Array(6).fill(MAX_SYNC_OPERATIONS), 2]);
		expect(await db.syncQueue.count()).toBe(0);
	} finally {
		clock.mockRestore();
		await db.delete();
	}
});

it.each([400, 422])('isolates HTTP %i failures without retrying rejected operations', async (status) => {
	const db = new ListDatabase('rejected-queue-test');
	const list = world.generate(listSchema);
	const delivered: (string | number)[] = [];
	let rejectedRequests = 0;
	const manager = createSyncManager(db, async (_url, init) => {
		const { operations } = syncRequestSchema.parse(JSON.parse(String(init?.body)));
		if (operations.some(({ id }) => id === 'rejected')) {
			rejectedRequests++;
			return new Response(null, { status });
		}
		delivered.push(...operations.map(({ id }) => id));
		return Response.json({ results: operations.map(({ id }) => ({ id, status: 'success' })) });
	});
	try {
		await db.syncQueue.bulkAdd(['first', 'rejected', 'last'].map((id) => ({
			id, type: 'DELETE', entity: 'list', data: { id: list.id }
		})));
		await manager.processQueue();
		expect(delivered).toEqual(['first', 'last']);
		expect(await db.syncQueue.toArray()).toEqual([
			expect.objectContaining({ id: 'rejected', rejection: { status, rejectedAt: expect.any(Number) } })
		]);

		const initialRejectedRequests = rejectedRequests;
		await db.syncQueue.add({ id: 'new', type: 'DELETE', entity: 'list', data: { id: list.id } });
		await manager.processQueue();
		expect(delivered).toEqual(['first', 'last', 'new']);
		expect(rejectedRequests).toBe(initialRejectedRequests);
		expect(manager.lastSyncError).toContain('saved locally');
	} finally {
		await db.delete();
	}
});

it('backs off after network errors and rate limits without rejecting queued edits', async () => {
	const db = new ListDatabase('sync-retry-backoff-test');
	const list = world.generate(listSchema);
	let now = Date.now();
	const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
	let requests = 0;
	const manager = createSyncManager(db, async () => {
		requests++;
		if (requests === 1) throw new TypeError('Network unavailable');
		if (requests === 2) return new Response(null, { status: 429 });
		return Response.json({ results: [{ id: 'queued', status: 'success' }] });
	});
	try {
		await db.syncQueue.add({ id: 'queued', type: 'DELETE', entity: 'list', data: { id: list.id } });
		await manager.processQueue();
		await manager.processQueue();
		expect(requests).toBe(1);
		now += 4_000;
		await manager.processQueue();
		now += 7_999;
		await manager.processQueue();
		expect(requests).toBe(2);
		expect((await db.syncQueue.toArray())[0].rejection).toBeUndefined();
		now++;
		await manager.processQueue();
		expect(requests).toBe(3);
		expect(await db.syncQueue.count()).toBe(0);
	} finally {
		clock.mockRestore();
		await db.delete();
	}
});
