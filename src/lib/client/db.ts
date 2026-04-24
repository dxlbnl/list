import Dexie, { type Table } from 'dexie';
import type { SyncOperationInput, LocalList, LocalItem } from '$lib/validations';

// Export types for use in other files
export type { LocalList, LocalItem };

// We wrap the SyncOperationInput to include Dexie's auto-incrementing local ID
export type QueuedSyncOperation = SyncOperationInput & { localId?: number };

export class ListDatabase extends Dexie {
	lists!: Table<LocalList>;
	items!: Table<LocalItem>;
	syncQueue!: Table<QueuedSyncOperation>;
	metadata!: Table<{ key: string; value: any }>;

	constructor() {
		super('ListAppDB');
		this.version(4).stores({
			lists: 'id, slug, createdBy, [createdBy+slug], createdAt',
			items: 'id, listId, name, groupName, rank, done, deletedAt, updatedAt, [listId+groupName]',
			syncQueue: '++localId, entity, type, timestamp',
			metadata: 'key'
		});
	}
}

export const db = new ListDatabase();
