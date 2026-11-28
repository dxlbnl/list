import { accountDatabaseName, readLocalAccountSelector } from '$lib/account';
import Dexie, { type Table } from 'dexie';
import type { SyncOperationInput, LocalList, LocalItem } from '$lib/validations';

// Export types for use in other files
export type { LocalList, LocalItem };

// We wrap the SyncOperationInput to include Dexie's auto-incrementing local ID
export type QueuedSyncOperation = SyncOperationInput & {
	localId?: number;
	rejection?: { status: number; rejectedAt: number };
};

export class ListDatabase extends Dexie {
	lists!: Table<LocalList>;
	items!: Table<LocalItem>;
	syncQueue!: Table<QueuedSyncOperation>;
	localMeta!: Table<{ key: string }, string>;

	constructor(name = 'ListAppDB') {
		super(name);
		this.version(4).stores({
			lists: 'id, slug, createdBy, [createdBy+slug], createdAt',
			items: 'id, listId, name, groupName, rank, done, deletedAt, updatedAt, [listId+groupName]',
			syncQueue: '++localId, entity, type, timestamp'
		});
		this.version(5).stores({ syncQueue: '++localId, entity, type, timestamp, data.id' });
		this.version(6).stores({ localMeta: 'key' });
	}
}

const LEGACY_DB = 'ListAppDB';
const ACTIVE_ACCOUNT = 'list-active-account';

export let db = new ListDatabase('ListAppDB:unbound');
let activeAccount: string | undefined;
let accountReady: Promise<void> | undefined;
let ready = false;

export function getLocalAccount() {
	return ready ? activeAccount : undefined;
}

async function importOwnedLegacyData(account: string, destination: ListDatabase) {
	const marker = { key: 'legacy-owned-data-imported' };
	if (await destination.localMeta.get(marker.key) || !await Dexie.exists(LEGACY_DB)) return;

	const legacy = new ListDatabase(LEGACY_DB);
	try {
		const owned = await legacy.transaction('r', legacy.lists, legacy.syncQueue, async () => {
			// Only list creation recorded its originating account in the
			// shared legacy queue. Retain unattributed data in that database.
			const operations = await legacy.syncQueue.filter(op =>
				op.entity === 'list' && op.type === 'INSERT' && op.data.createdBy === account
			).toArray();
			const lists = (await legacy.lists.bulkGet(operations.map(op => op.data.id)))
				.filter((list): list is LocalList => list?.createdBy === account);
			const listIds = new Set(lists.map(list => list.id));
			return { lists, operations: operations.filter(op => listIds.has(op.data.id)) };
		});
		await destination.transaction('rw', destination.lists, destination.syncQueue, destination.localMeta, async () => {
			if (await destination.localMeta.get(marker.key)) return;
			for (const list of owned.lists) {
				if (!await destination.lists.get(list.id)) await destination.lists.put(list);
			}
			const existing = new Set((await destination.syncQueue.toArray()).map(op => op.id));
			await destination.syncQueue.bulkAdd(owned.operations
				.filter(op => !existing.has(op.id))
				.map(op => ({ ...op, localId: undefined })));
			await destination.localMeta.add(marker);
		});
	} finally {
		legacy.close();
	}
}

async function importAnonymousPendingData(source: string, account: string, destination: ListDatabase) {
	if (source === account) return;
	const sourceName = accountDatabaseName(source);
	if (!await Dexie.exists(sourceName)) return;
	const marker = { key: `anonymous-account-merged:${source}` };
	if (await destination.localMeta.get(marker.key)) return;

	const previous = new ListDatabase(sourceName);
	try {
		const pending = await previous.transaction('r', previous.lists, previous.items, previous.syncQueue, async () => {
			const operations = await previous.syncQueue.toArray();
			const lists = await previous.lists.bulkGet(operations.filter(op => op.entity === 'list').map(op => op.data.id));
			const items = await previous.items.bulkGet(operations.filter(op => op.entity === 'item').map(op => op.data.id));
			return { operations, lists, items };
		});
		await destination.transaction('rw', destination.lists, destination.items, destination.syncQueue, destination.localMeta, async () => {
			if (await destination.localMeta.get(marker.key)) return;

			for (const list of pending.lists) {
				if (list && !await destination.lists.get(list.id)) {
					await destination.lists.put({ ...list, createdBy: list.createdBy === source ? account : list.createdBy });
				}
			}
			for (const item of pending.items) {
				if (item && !await destination.items.get(item.id)) await destination.items.put(item);
			}
			if (pending.operations.length > 0) {
				const existing = new Set((await destination.syncQueue.toArray()).map(op => op.id));
				await destination.syncQueue.bulkAdd(pending.operations
					.filter(op => !existing.has(op.id))
					.map(op => ({ ...op, localId: undefined })));
			}
			await destination.localMeta.add(marker);
		});
	} finally {
		previous.close();
	}
}

/** One authenticated account owns this browser document and its sync state. */
export function bindLocalAccount(account: string, previousAnonymousAccount?: string) {
	if (activeAccount && activeAccount !== account) {
		// Stop this navigation before it can render the previous account's cache.
		window.location.reload();
		return new Promise<void>(() => {});
	}
	if (accountReady) return accountReady;

	activeAccount = account;
	db = new ListDatabase(accountDatabaseName(account));
	const destination = db;
	accountReady = (async () => {
		await importOwnedLegacyData(account, destination);
		if (previousAnonymousAccount) await importAnonymousPendingData(previousAnonymousAccount, account, destination);
		ready = true;
	})();
	try {
		localStorage.setItem(ACTIVE_ACCOUNT, account);
	} catch { /* Storage can be disabled. API requests remain account-bound. */ }
	window.addEventListener('storage', (event) => {
		if (event.key === ACTIVE_ACCOUNT && event.newValue !== account) window.location.reload();
	});
	window.addEventListener('pageshow', (event) => {
		if (!event.persisted) return;
		if (readLocalAccountSelector(document.cookie) !== account) window.location.reload();
	});
	return accountReady;
}
