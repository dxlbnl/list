import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { eq, and, inArray, lt } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import type { RequestHandler } from './$types';
import { syncHub } from '$lib/server/sync';
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
	const updatedListIds = new Set<string>();
	const deletedListMembers = new Map<string, string[]>();

	const results: { id: string | number; status: 'success' | 'error'; message?: string }[] = [];
	const updatedListIds = new Set<string>();
	const deletedListMembers = new Map<string, string[]>();

	try {
		// 1. PRE-FETCH DATA (Batched into 1 HTTP request)
		const preFetchQueries: any[] = [
			db.select({ listId: listUsers.listId }).from(listUsers).where(eq(listUsers.userId, user.id))
		];

		const itemIdsToFetch = operations
			.filter(op => op.entity === 'item' && op.type === 'UPDATE' && !op.data.listId)
			.map(op => op.entityId);
		if (itemIdsToFetch.length > 0) {
			preFetchQueries.push(db.select({ id: items.id, listId: items.listId }).from(items).where(inArray(items.id, itemIdsToFetch)));
		}

		const listsBeingDeleted = operations
			.filter(op => op.entity === 'list' && op.type === 'DELETE')
			.map(op => op.entityId);
		if (listsBeingDeleted.length > 0) {
			preFetchQueries.push(db.select({ listId: listUsers.listId, userId: listUsers.userId }).from(listUsers).where(inArray(listUsers.listId, listsBeingDeleted)));
		}

		const preFetchResults = await db.batch(preFetchQueries as [any, ...any[]]);
		
		const authorizedListIds = new Set((preFetchResults[0] as any[]).map(a => a.listId));
		const itemIdToListId = new Map<string, string>();
		if (itemIdsToFetch.length > 0) {
			const fetchedItems = (preFetchResults[1] as any[]);
			for (const item of fetchedItems) itemIdToListId.set(item.id, item.listId);
		}
		if (listsBeingDeleted.length > 0) {
			const members = (preFetchResults[itemIdsToFetch.length > 0 ? 2 : 1] as any[]);
			for (const m of members) {
				if (!deletedListMembers.has(m.listId)) deletedListMembers.set(m.listId, []);
				deletedListMembers.get(m.listId)!.push(m.userId);
			}
		}

		// 2. OPERATIONS (Batched into 1 HTTP request)
		const batchQueries: any[] = [];
		const opStatusMapping: { opIndex: number; success: boolean; error?: string }[] = [];

		for (let i = 0; i < operations.length; i++) {
			const op = operations[i];
			let queryAdded = false;

			if (op.entity === 'list') {
				if (op.type === 'INSERT') {
					batchQueries.push(
						db.insert(lists).values({
							id: op.entityId,
							slug: op.data.slug,
							name: op.data.name,
							createdBy: user.id,
							createdAt: new Date(op.data.createdAt)
						}).onConflictDoUpdate({
							target: lists.id,
							set: { name: op.data.name }
						})
					);
					batchQueries.push(
						db.insert(listUsers).values({
							listId: op.entityId,
							userId: user.id
						}).onConflictDoNothing()
					);
					authorizedListIds.add(op.entityId);
					updatedListIds.add('global');
					updatedListIds.add(op.entityId);
					queryAdded = true;
				} else if (op.type === 'UPDATE') {
					if (authorizedListIds.has(op.entityId)) {
						batchQueries.push(
							db.update(lists).set({ name: op.data.name }).where(eq(lists.id, op.entityId))
						);
						updatedListIds.add('global');
						updatedListIds.add(op.entityId);
						queryAdded = true;
					} else {
						opStatusMapping.push({ opIndex: i, success: false, error: 'Unauthorized access to list' });
					}
				} else if (op.type === 'DELETE') {
					if (authorizedListIds.has(op.entityId)) {
						batchQueries.push(db.delete(items).where(eq(items.listId, op.entityId)));
						batchQueries.push(db.delete(listUsers).where(eq(listUsers.listId, op.entityId)));
						batchQueries.push(db.delete(lists).where(eq(lists.id, op.entityId)));
						updatedListIds.add('global');
						updatedListIds.add(op.entityId);
						queryAdded = true;
					} else {
						opStatusMapping.push({ opIndex: i, success: false, error: 'Unauthorized access to list' });
					}
				}
			} else if (op.entity === 'item') {
				const listId = op.data.listId || itemIdToListId.get(op.entityId);
				if (listId && authorizedListIds.has(listId)) {
					if (op.type === 'INSERT') {
						const itemDate = new Date(op.data.updatedAt);
						batchQueries.push(
							db.insert(items).values({
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
							})
						);
						updatedListIds.add(listId);
						queryAdded = true;
					} else if (op.type === 'UPDATE') {
						const updateData: any = { updatedAt: new Date() };
						if (op.data.name !== undefined) updateData.name = op.data.name;
						if (op.data.groupName !== undefined) updateData.groupName = op.data.groupName;
						if (op.data.rank !== undefined) updateData.rank = op.data.rank;
						if (op.data.done !== undefined) updateData.done = op.data.done;
						if (op.data.deletedAt !== undefined) updateData.deletedAt = op.data.deletedAt ? new Date(op.data.deletedAt) : null;
						
						const itemDate = op.data.updatedAt ? new Date(op.data.updatedAt) : new Date();
						if (op.data.updatedAt) updateData.updatedAt = itemDate;

						batchQueries.push(
							db.update(items)
								.set(updateData)
								.where(and(
									eq(items.id, op.entityId),
									lt(items.updatedAt, itemDate)
								))
						);
						updatedListIds.add(listId);
						queryAdded = true;
					}
				} else {
					opStatusMapping.push({ opIndex: i, success: false, error: 'Unauthorized access to item list' });
				}
			}
			
			if (queryAdded) opStatusMapping.push({ opIndex: i, success: true });
		}

		if (batchQueries.length > 0) {
			await db.batch(batchQueries as [any, ...any[]]);
		}

		// 3. SNAPSHOTS (Batched into 1 HTTP request)
		const notifications: { channel: string; payload: any }[] = [];
		const updatedListIdsArray = Array.from(updatedListIds).filter(id => id !== 'global');

		if (updatedListIdsArray.length > 0) {
			const [allLists, allItems, allListUsers] = await db.batch([
				db.select().from(lists).where(inArray(lists.id, updatedListIdsArray)),
				db.select().from(items).where(inArray(items.listId, updatedListIdsArray)),
				db.select().from(listUsers).where(inArray(listUsers.listId, updatedListIdsArray))
			]);

			const listsMap = new Map((allLists as any[]).map(l => [l.id, l]));
			const itemsByList = new Map<string, any[]>();
			for (const item of (allItems as any[])) {
				if (!itemsByList.has(item.listId)) itemsByList.set(item.listId, []);
				itemsByList.get(item.listId)!.push(item);
			}
			const usersByList = new Map<string, string[]>();
			for (const lu of (allListUsers as any[])) {
				if (!usersByList.has(lu.listId)) usersByList.set(lu.listId, []);
				usersByList.get(lu.listId)!.push(lu.userId);
			}

			for (const listId of updatedListIdsArray) {
				const listRecord = listsMap.get(listId);
				if (listRecord) {
					const listItems = itemsByList.get(listId) || [];
					const authorizedUsers = usersByList.get(listId) || [];
					const payload = { list: listRecord, items: listItems, listId };
					for (const userId of authorizedUsers) notifications.push({ channel: `user:${userId}`, payload });
				} else {
					const memberIds = deletedListMembers.get(listId) || [];
					for (const userId of memberIds) notifications.push({ channel: `user:${userId}`, payload: { listId, deleted: true } });
				}
			}
		}

		if (updatedListIds.has('global')) {
			notifications.push({ channel: `user:${user.id}`, payload: { listId: 'global' } });
		}

		// 4. Map results and emit notifications
		for (const mapping of opStatusMapping) {
			const op = operations[mapping.opIndex];
			results.push(mapping.success ? { id: op.id, status: 'success' } : { id: op.id, status: 'error', message: mapping.error });
		}

		for (const { channel, payload } of notifications) {
			syncHub.emit(channel, payload, clientId);
		}

		return json({ results });
	} catch (e) {
		syncLogger.error('Sync failed', { userId: user.id }, e);
		throw error(500, MESSAGES.DATA.PROCESS_ERROR);
	}
};

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) throw error(401, MESSAGES.AUTH.UNAUTHORIZED);

	const clientId = url.searchParams.get('clientId');
	const encoder = new TextEncoder();
	const connectionId = Math.random().toString(36).slice(2, 10);

	const stream = new ReadableStream({
		start(controller) {
			syncLogger.info(`SSE connection started`, { connectionId, userId: user.id, clientId });
			
			const onUpdate = (payload: any, senderId?: string) => {
				// Filter out echo messages
				if (senderId && senderId === clientId) {
					syncLogger.debug(`SSE skipping echo update`, { connectionId, clientId, senderId });
					return;
				}

				syncLogger.debug(`SSE sending update`, { connectionId, listId: payload.listId || 'global' });
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', ...payload })}\n\n`));
				} catch (e) {
					cleanup();
				}
			};

			const cleanup = () => {
				syncLogger.info(`SSE connection cleanup`, { connectionId, userId: user.id });
				syncHub.off(`user:${user.id}`, onUpdate);
				try { controller.close(); } catch (e) {}
			};

			syncHub.on(`user:${user.id}`, onUpdate);
			controller.enqueue(encoder.encode(': connected\n\n'));

			const interval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch (e) {
					clearInterval(interval);
					cleanup();
				}
			}, 30000);

			return cleanup;
		},
		cancel() {
			syncLogger.info(`SSE connection cancelled by client`, { connectionId, userId: user.id });
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			'X-Accel-Buffering': 'no'
		}
	});
};

