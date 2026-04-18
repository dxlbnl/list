import Dexie, { type Table } from 'dexie';

export interface LocalList {
	id: string;
	slug: string;
	name: string;
	createdBy: string;
	createdAt: Date;
	isLocalOnly?: boolean; // True if not yet synced to server
}

export interface LocalItem {
	id: string;
	listId: string;
	name: string;
	groupName: string | null;
	rank: number;
	done: boolean;
	deletedAt: Date | null;
	updatedAt: Date;
	isLocalOnly?: boolean;
}

export interface SyncOperation {
	id?: number;
	type: 'INSERT' | 'UPDATE' | 'DELETE';
	entity: 'list' | 'item';
	entityId: string;
	data: any;
	timestamp: number;
}

export class ListDatabase extends Dexie {
	lists!: Table<LocalList>;
	items!: Table<LocalItem>;
	syncQueue!: Table<SyncOperation>;

	constructor() {
		super('ListAppDB');
		this.version(1).stores({
			lists: 'id, slug, createdBy, [createdBy+slug], createdAt',
			items: 'id, listId, name, groupName, rank, done, deletedAt, updatedAt',
			syncQueue: '++id, entityId, timestamp'
		});
	}
}

export const db = new ListDatabase();
