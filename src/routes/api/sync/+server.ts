import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const { operations } = await request.json();

	if (!Array.isArray(operations)) {
		throw error(400, 'Invalid operations format');
	}

	const results = [];

	for (const op of operations) {
		try {
			if (op.entity === 'list') {
				if (op.type === 'INSERT') {
					await db.insert(lists).values({
						id: op.entityId,
						slug: op.data.slug,
						name: op.data.name,
						createdBy: user.id,
						createdAt: new Date(op.data.createdAt)
					});
					
					// Grant access to the creator
					await db.insert(listUsers).values({
						listId: op.entityId,
						userId: user.id
					});
				} else if (op.type === 'UPDATE') {
					// Verify access
					const access = await db
						.select()
						.from(listUsers)
						.where(and(eq(listUsers.listId, op.entityId), eq(listUsers.userId, user.id)));
					
					if (access.length > 0) {
						await db
							.update(lists)
							.set({ name: op.data.name })
							.where(eq(lists.id, op.entityId));
					}
				}
			} else if (op.entity === 'item') {
				if (op.type === 'INSERT') {
					// Verify access to list
					const access = await db
						.select()
						.from(listUsers)
						.where(and(eq(listUsers.listId, op.data.listId), eq(listUsers.userId, user.id)));
					
					if (access.length > 0) {
						await db.insert(items).values({
							id: op.entityId,
							listId: op.data.listId,
							name: op.data.name,
							groupName: op.data.groupName,
							rank: op.data.rank,
							done: op.data.done,
							deletedAt: op.data.deletedAt ? new Date(op.data.deletedAt) : null,
							updatedAt: new Date(op.data.updatedAt)
						});
					}
				} else if (op.type === 'UPDATE') {
					// Get current item to find its listId
					const currentItem = await db
						.select()
						.from(items)
						.where(eq(items.id, op.entityId));
					
					if (currentItem.length > 0) {
						// Verify access
						const access = await db
							.select()
							.from(listUsers)
							.where(and(eq(listUsers.listId, currentItem[0].listId), eq(listUsers.userId, user.id)));
						
						if (access.length > 0) {
							await db
								.update(items)
								.set({
									name: op.data.name ?? currentItem[0].name,
									groupName: op.data.groupName !== undefined ? op.data.groupName : currentItem[0].groupName,
									rank: op.data.rank ?? currentItem[0].rank,
									done: op.data.done !== undefined ? op.data.done : currentItem[0].done,
									deletedAt: op.data.deletedAt !== undefined ? (op.data.deletedAt ? new Date(op.data.deletedAt) : null) : currentItem[0].deletedAt,
									updatedAt: new Date()
								})
								.where(eq(items.id, op.entityId));
						}
					}
				}
			}
			results.push({ id: op.id, status: 'success' });
		} catch (e) {
			console.error(`Sync error for op ${op.id}:`, e);
			results.push({ id: op.id, status: 'error', message: (e as Error).message });
		}
	}

	return json({ results });
};
