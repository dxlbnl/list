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

it('retains a rejected operation and acknowledges the valid operations around it', async () => {
	const db = new ListDatabase('rejected-queue-test');
	const list = world.generate(listSchema);
	const delivered: (string | number)[] = [];
	const manager = createSyncManager(db, async (_url, init) => {
		const { operations } = syncRequestSchema.parse(JSON.parse(String(init?.body)));
		if (operations.some(({ id }) => id === 'rejected')) return new Response(null, { status: 400 });
		delivered.push(...operations.map(({ id }) => id));
		return Response.json({ results: operations.map(({ id }) => ({ id, status: 'success' })) });
	});
	try {
		await db.syncQueue.bulkAdd(['first', 'rejected', 'last'].map((id) => ({
			id, type: 'DELETE', entity: 'list', data: { id: list.id }
		})));
		await manager.processQueue();
		expect(delivered).toEqual(['first', 'last']);
		expect((await db.syncQueue.toArray()).map(({ id }) => id)).toEqual(['rejected']);
	} finally {
		await db.delete();
	}
});
