import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { eq, and, inArray, lt, sql } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import type { RequestHandler } from './$types';
import { syncRequestSchema } from '$lib/validations';
import { logger } from '$lib/logger';

const syncLogger = logger.child({ module: 'sync' });

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, MESSAGES.AUTH.UNAUTHORIZED);

	const body = await request.json();
	const validation = syncRequestSchema.safeParse(body);

	if (!validation.success) {
		syncLogger.error('Sync validation failed', { error: validation.error.format(), userId: user.id });
		throw error(400, `${MESSAGES.DATA.PROCESS_ERROR}: ${validation.error.message}`);
	}

	const { operations, clientId } = validation.data;
	syncLogger.info(`Processing ${operations.length} operations`, { userId: user.id, count: operations.length, clientId });

	const results: { id: string | number; status: 'success' | 'error'; message?: string }[] = [];
	const tStart = performance.now();

	try {
		// 1. PRE-FETCH AUTH DATA
		const memberships = await db.select({ 
			listId: listUsers.listId,
			createdBy: lists.createdBy 
		})
			.from(listUsers)
			.innerJoin(lists, eq(listUsers.listId, lists.id))
			.where(eq(listUsers.userId, user.id));
		
		const authorizedListIds = new Set(memberships.map(m => m.listId));
		const ownedListIds = new Set(memberships.filter(m => m.createdBy === user.id).map(m => m.listId));

		// Prefetch item list IDs if missing
		const itemIdsToFetch = operations
			.filter(op => op.entity === 'item' && op.type === 'UPDATE' && !op.data.listId)
			.map(op => op.entityId);
		
		const itemIdToListId = new Map<string, string>();
		if (itemIdsToFetch.length > 0) {
			const fetchedItems = await db.select({ id: items.id, listId: items.listId })
				.from(items)
				.where(inArray(items.id, itemIdsToFetch));
			
			for (const item of fetchedItems) itemIdToListId.set(item.id, item.listId);
		}

		// 2. EXECUTE OPERATIONS
		// Note: For simplicity and correct error reporting per-operation, we still loop, 
		// but we wrap in a single transaction to minimize round trips for COMMIT.
		await db.transaction(async (tx) => {
			for (const op of operations) {
				let success = false;
				let errorMsg: string | undefined;

				try {
					if (op.entity === 'list') {
						if (op.type === 'INSERT') {
							await tx.insert(lists).values({
								id: op.entityId,
								slug: op.data.slug,
								name: op.data.name,
								createdBy: user.id,
								createdAt: new Date(op.data.createdAt)
							}).onConflictDoUpdate({
								target: lists.id,
								set: { name: op.data.name }
							});

							await tx.insert(listUsers).values({
								listId: op.entityId,
								userId: user.id
							}).onConflictDoNothing();

							authorizedListIds.add(op.entityId);
							success = true;
						} else if (op.type === 'UPDATE') {
							if (authorizedListIds.has(op.entityId)) {
								await tx.update(lists).set({ name: op.data.name }).where(eq(lists.id, op.entityId));
								success = true;
							} else {
								errorMsg = 'Unauthorized access to list';
							}
						} else if (op.type === 'DELETE') {
							if (ownedListIds.has(op.entityId)) {
								// Owner: Delete the entire list (cascades to items and members)
								await tx.delete(lists).where(eq(lists.id, op.entityId));
								success = true;
							} else if (authorizedListIds.has(op.entityId)) {
								// Member (not owner): Just leave the list
								await tx.delete(listUsers).where(and(
									eq(listUsers.listId, op.entityId),
									eq(listUsers.userId, user.id)
								));
								success = true;
							} else {
								errorMsg = 'Unauthorized access to list';
							}
						}
					} else if (op.entity === 'item') {
						const listId = op.data.listId || itemIdToListId.get(op.entityId);
						if (listId && authorizedListIds.has(listId)) {
							if (op.type === 'INSERT') {
								const itemDate = new Date(op.data.updatedAt);
								await tx.insert(items).values({
									id: op.entityId,
									listId: listId,
									name: op.data.name,
									groupName: op.data.groupName,
									rank: op.data.rank,
									done: op.data.done,
									deletedAt: op.data.deletedAt ? new Date(op.data.deletedAt) : null,
									updatedAt: itemDate
								}).onConflictDoUpdate({
									target: items.id,
									set: {
										name: op.data.name,
										groupName: op.data.groupName,
										rank: op.data.rank,
										done: op.data.done,
										deletedAt: op.data.deletedAt ? new Date(op.data.deletedAt) : null,
										updatedAt: itemDate
									},
									where: lt(items.updatedAt, itemDate)
								});
								success = true;
							} else if (op.type === 'UPDATE') {
								const itemDate = op.data.updatedAt ? new Date(op.data.updatedAt) : new Date();
								const updateData: any = { updatedAt: itemDate };
								if (op.data.name !== undefined) updateData.name = op.data.name;
								if (op.data.groupName !== undefined) updateData.groupName = op.data.groupName;
								if (op.data.rank !== undefined) updateData.rank = op.data.rank;
								if (op.data.done !== undefined) updateData.done = op.data.done;
								if (op.data.deletedAt !== undefined) updateData.deletedAt = op.data.deletedAt ? new Date(op.data.deletedAt) : null;

								await tx.update(items)
									.set(updateData)
									.where(and(
										eq(items.id, op.entityId),
										lt(items.updatedAt, itemDate)
									));
								success = true;
							}
						} else {
							errorMsg = 'Unauthorized access to item list';
						}
					}
				} catch (opErr: any) {
					errorMsg = opErr.message;
					syncLogger.error('Operation failed', { opId: op.id, error: opErr.message });
				}

				results.push(success ? { id: op.id, status: 'success' } : { id: op.id, status: 'error', message: errorMsg });
			}
		});

		const tTotal = performance.now() - tStart;
		syncLogger.info(`Sync complete`, { tTotal: tTotal.toFixed(2), opCount: operations.length });

		return json({ results });
	} catch (e: any) {
		syncLogger.error('Sync transaction failed', { userId: user.id, error: e.message });
		throw error(500, `${MESSAGES.DATA.PROCESS_ERROR}: ${e.message}`);
	}
};
