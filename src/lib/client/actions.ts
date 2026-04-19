import { db } from '$lib/client/db';
import { slugify, isReservedSlug, nanoid } from '$lib/utils';
import { syncManager } from './sync.svelte';

export async function createList(name: string, userId: string) {
	const id = nanoid();
	let slug = slugify(name) || 'untitled';

	// Check for collisions in local DB or reserved slugs
	const existing = await db.lists.where('slug').equals(slug).first();
	if (existing || isReservedSlug(slug)) {
		slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
	}

	const newList = {
		id,
		slug,
		name,
		createdBy: userId,
		createdAt: new Date(),
		isLocalOnly: true
	};

	await db.lists.add(newList);

	// Queue sync
	await db.syncQueue.add({
		type: 'INSERT',
		entity: 'list',
		entityId: id,
		data: newList,
		timestamp: Date.now()
	});

	syncManager.forceSync();
	return id;
}

export async function addItem(listId: string, name: string, groupName: string = "") {
	const id = nanoid();
	const newItem = {
		id,
		listId,
		name,
		groupName,
		rank: Date.now(), // Simplified rank for now
		done: false,
		deletedAt: null,
		updatedAt: new Date(),
		isLocalOnly: true
	};

	await db.items.add(newItem);

	await db.syncQueue.add({
		type: 'INSERT',
		entity: 'item',
		entityId: id,
		data: newItem,
		timestamp: Date.now()
	});

	syncManager.forceSync();
	return id;
}

export async function updateItem(itemId: string, data: any) {
	await db.items.update(itemId, { ...data, updatedAt: new Date() });

	await db.syncQueue.add({
		type: 'UPDATE',
		entity: 'item',
		entityId: itemId,
		data: { ...data, updatedAt: new Date() },
		timestamp: Date.now()
	});

	syncManager.forceSync();
}

export async function updateItems(updates: { id: string; data: any }[]) {
	if (updates.length === 0) return;
	
	for (const { id, data } of updates) {
		await db.items.update(id, { ...data, updatedAt: new Date() });
		await db.syncQueue.add({
			type: 'UPDATE',
			entity: 'item',
			entityId: id,
			data: { ...data, updatedAt: new Date() },
			timestamp: Date.now()
		});
	}

	syncManager.forceSync();
}

export async function deleteItem(itemId: string) {
	const deletedAt = new Date();
	await db.items.update(itemId, { deletedAt });

	await db.syncQueue.add({
		type: 'UPDATE',
		entity: 'item',
		entityId: itemId,
		data: { deletedAt },
		timestamp: Date.now()
	});

	syncManager.forceSync();
}

export async function deleteList(listId: string) {
	await db.lists.delete(listId);
	// Also delete all items associated with this list locally
	await db.items.where('listId').equals(listId).delete();

	await db.syncQueue.add({
		type: 'DELETE',
		entity: 'list',
		entityId: listId,
		data: {},
		timestamp: Date.now()
	});

	syncManager.forceSync();
}

export async function renameGroup(listId: string, oldName: string, newName: string) {
	const items = await db.items.where({ listId, groupName: oldName }).toArray();
	for (const item of items) {
		await updateItem(item.id, { groupName: newName });
	}
}

export async function deleteGroup(listId: string, groupName: string) {
	const items = await db.items.where({ listId, groupName }).toArray();
	for (const item of items) {
		await deleteItem(item.id);
	}
}
