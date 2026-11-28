import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { accountDatabaseName } from '$lib/account';
import { world } from '$lib/test/fixtures';
import { listSchema } from '$lib/validations';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

it('keeps the source account cache and queued operations separate on switch', async () => {
	const localWindow = new EventTarget();
	vi.stubGlobal('window', Object.assign(localWindow, { location: { reload: vi.fn() } }));
	vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() });

	const sourceList = world.generate(listSchema);
	const targetList = world.generate(listSchema);
	const { ListDatabase, bindLocalAccount } = await import('./db');
	const source = new ListDatabase(accountDatabaseName(sourceList.createdBy));
	const target = new ListDatabase(accountDatabaseName(targetList.createdBy));

	try {
		await source.lists.put(sourceList);
		await source.syncQueue.add({ id: 'source-pending', entity: 'list', type: 'INSERT', data: sourceList });
		await target.lists.put(targetList);

		await bindLocalAccount(targetList.createdBy);
		const { db, getLocalAccount } = await import('./db');
		expect(getLocalAccount()).toBe(targetList.createdBy);
		expect(await db.lists.toArray()).toEqual([targetList]);
		expect(await db.syncQueue.count()).toBe(0);
		expect(await source.lists.get(sourceList.id)).toEqual(sourceList);
		expect(await source.syncQueue.count()).toBe(1);

		db.close();
	} finally {
		await source.delete();
		await target.delete();
	}
});


it('imports pending anonymous edits only after a confirmed merge', async () => {
	vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { reload: vi.fn() } }));
	vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() });

	const sourceList = world.generate(listSchema, { overrides: { isLocalOnly: true } });
	const targetList = world.generate(listSchema);
	const { ListDatabase, bindLocalAccount } = await import('./db');
	const source = new ListDatabase(accountDatabaseName(sourceList.createdBy));
	const target = new ListDatabase(accountDatabaseName(targetList.createdBy));

	try {
		await source.lists.put(sourceList);
		await source.syncQueue.add({ id: 'anonymous-pending', entity: 'list', type: 'INSERT', data: sourceList });
		await target.lists.put(targetList);
		await target.syncQueue.add({ id: 'target-pending', entity: 'list', type: 'INSERT', data: targetList });

		await bindLocalAccount(targetList.createdBy, sourceList.createdBy);
		const { db } = await import('./db');
		expect(await db.lists.get(sourceList.id)).toMatchObject({ createdBy: targetList.createdBy });
		expect((await db.syncQueue.toArray()).map(op => op.id)).toEqual(['target-pending', 'anonymous-pending']);
		expect(await source.syncQueue.count()).toBe(1);
		db.close();
	} finally {
		await source.delete();
		await target.delete();
	}
});
