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

	syncManager.processQueue();
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

	syncManager.processQueue();
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

	syncManager.processQueue();
}

export async function updateItems(updates: { id: string; data: any }[]) {
	if (updates.length === 0) return;
	
	const now = new Date();
	const timestamp = Date.now();
	
	// Prepare bulk item updates
	const ids = updates.map(u => u.id);
	const currentItems = await db.items.bulkGet(ids);
	const itemMap = new Map(currentItems.filter(Boolean).map(i => [i!.id, i!]));

	const itemUpdates = updates.map(({ id, data }) => {
		const current = itemMap.get(id);
		return {
			...current,
			...data,
			updatedAt: now
		};
	});

	await db.items.bulkPut(itemUpdates);

	// Prepare bulk sync queue operations
	const syncOps = updates.map(({ id, data }) => ({
		type: 'UPDATE' as const,
		entity: 'item' as const,
		entityId: id,
		data: { ...data, updatedAt: now },
		timestamp
	}));

	await db.syncQueue.bulkPut(syncOps);

	syncManager.processQueue();
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

	syncManager.processQueue();
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

	syncManager.processQueue();
}

export async function renameGroup(listId: string, oldName: string, newName: string) {
	const actualOldName = oldName === "GENERAL" ? "" : oldName;
	const actualNewName = newName === "GENERAL" ? "" : newName;
	
	const groupItems = await db.items.where({ listId, groupName: actualOldName }).toArray();
	if (groupItems.length === 0) return;

	const updates = groupItems.map(item => ({
		id: item.id,
		data: { groupName: actualNewName }
	}));

	await updateItems(updates);
}

export async function deleteGroup(listId: string, groupName: string) {
	const actualGroupName = groupName === "GENERAL" ? "" : groupName;
	const groupItems = await db.items.where({ listId, groupName: actualGroupName }).toArray();
	
	for (const item of groupItems) {
		await deleteItem(item.id);
	}
}

export async function shareList(listId: string, expiresAt: string | null) {
	const res = await fetch(`/api/lists/${listId}/share`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ expiresAt }),
	});
	
	if (!res.ok) {
		throw new Error(`Failed to generate share link: ${res.statusText}`);
	}
	
	return await res.json();
}

