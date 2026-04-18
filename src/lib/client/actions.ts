import { db } from '$lib/client/db';
import { slugify } from '$lib/utils';

export async function createList(name: string, userId: string) {
	const id = crypto.randomUUID();
	let slug = slugify(name) || 'untitled';

	// Check for collisions in local DB
	const existing = await db.lists.where('slug').equals(slug).first();
	if (existing) {
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

	return id;
}

export async function addItem(listId: string, name: string) {
	const id = crypto.randomUUID();
	const newItem = {
		id,
		listId,
		name,
		groupName: null,
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

	return id;
}
