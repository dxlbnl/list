import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import type { RequestHandler } from './$types';
import { syncHub } from '$lib/server/sync';
import { syncRequestSchema } from '$lib/validations';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, MESSAGES.AUTH.UNAUTHORIZED);

	const body = await request.json();
	const validation = syncRequestSchema.safeParse(body);

	if (!validation.success) {
		console.error('Sync validation failed:', validation.error.format());
		throw error(400, `${MESSAGES.DATA.PROCESS_ERROR}: ${validation.error.message}`);
	}

	const { operations } = validation.data;

	const results = [];
	const updatedListIds = new Set<string>();

	const deletedListMembers = new Map<string, string[]>();

	for (const op of operations) {
		try {
			if (op.entity === 'list') {
				if (op.type === 'INSERT') {
					await db
						.insert(lists)
						.values({
							id: op.entityId,
							slug: op.data.slug,
							name: op.data.name,
							createdBy: user.id,
							createdAt: new Date(op.data.createdAt)
						})
						.onConflictDoUpdate({
							target: lists.id,
							set: { name: op.data.name }
						});
					
					// Grant access to the creator
					await db
						.insert(listUsers)
						.values({
							listId: op.entityId,
							userId: user.id
						})
						.onConflictDoNothing();
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
				} else if (op.type === 'DELETE') {
					// Verify access
					const access = await db
						.select()
						.from(listUsers)
						.where(and(eq(listUsers.listId, op.entityId), eq(listUsers.userId, user.id)));
					
					if (access.length > 0) {
						// CAPTURE MEMBERS BEFORE DELETION
						const members = await db
							.select({ userId: listUsers.userId })
							.from(listUsers)
							.where(eq(listUsers.listId, op.entityId));
						
						deletedListMembers.set(op.entityId, members.map(m => m.userId));

						// Delete items first
						await db.delete(items).where(eq(items.listId, op.entityId));
						// Delete list access records
						await db.delete(listUsers).where(eq(listUsers.listId, op.entityId));
						// Delete the list
						await db.delete(lists).where(eq(lists.id, op.entityId));
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
						await db
							.insert(items)
							.values({
								id: op.entityId,
								listId: op.data.listId,
								name: op.data.name,
								groupName: op.data.groupName,
								rank: op.data.rank,
								done: op.data.done,
								deletedAt: op.data.deletedAt ? new Date(op.data.deletedAt) : null,
								updatedAt: new Date(op.data.updatedAt)
							})
							.onConflictDoUpdate({
								target: items.id,
								set: {
									name: op.data.name,
									groupName: op.data.groupName,
									rank: op.data.rank,
									done: op.data.done,
									deletedAt: op.data.deletedAt ? new Date(op.data.deletedAt) : null,
									updatedAt: new Date(op.data.updatedAt)
								}
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
			
			// Track which lists were updated
			if (op.entity === 'list') {
				updatedListIds.add('global'); // Trigger global refresh for list changes
				updatedListIds.add(op.entityId);
			}
			if (op.entity === 'item') {
				let listIdToNotify = op.data?.listId;
				if (!listIdToNotify) {
					const itemRecord = await db.select().from(items).where(eq(items.id, op.entityId)).limit(1);
					if (itemRecord[0]) listIdToNotify = itemRecord[0].listId;
				}
				if (listIdToNotify) {
					console.log(`Queueing notification for list: ${listIdToNotify} due to ${op.entity} ${op.type}`);
					updatedListIds.add(listIdToNotify);
				}
			}
		} catch (e) {
			console.error(`Sync error for op ${op.id}:`, e);
			results.push({ id: op.id, status: 'error', message: (e as Error).message });
		}
	}

	// Broadcast updates
	const notifications = [];
	
	for (const listId of updatedListIds) {
		if (listId === 'global') {
			notifications.push({ channel: `user:${user.id}`, payload: { listId: 'global' } });
			continue;
		}

		const [listRecord] = await db.select().from(lists).where(eq(lists.id, listId));
		
		if (listRecord) {
			const listItems = await db.select().from(items).where(eq(items.listId, listId));
			const payload = { list: listRecord, items: listItems, listId };
			
			const authorizedUsers = await db
				.select({ userId: listUsers.userId })
				.from(listUsers)
				.where(eq(listUsers.listId, listId));

			for (const { userId } of authorizedUsers) {
				notifications.push({ channel: `user:${userId}`, payload });
			}
		} else {
			// List was deleted - use captured members
			const memberIds = deletedListMembers.get(listId) || [];
			for (const userId of memberIds) {
				notifications.push({ channel: `user:${userId}`, payload: { listId, deleted: true } });
			}
		}
	}

	// Emit all notifications in order
	for (const { channel, payload } of notifications) {
		console.log(`Pushing update to channel ${channel}`);
		syncHub.emit(channel, payload);
	}

	return json({ results });
};

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) throw error(401, MESSAGES.AUTH.UNAUTHORIZED);

	const encoder = new TextEncoder();
	const connectionId = Math.random().toString(36).slice(2, 10);

	const stream = new ReadableStream({
		start(controller) {
			console.log(`[${connectionId}] SSE starting for user: ${user.id}`);
			
			const onUpdate = (payload: any) => {
				console.log(`[${connectionId}] SSE sending update:`, payload.listId || 'global');
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', ...payload })}\n\n`));
				} catch (e) {
					cleanup();
				}
			};

			const cleanup = () => {
				console.log(`[${connectionId}] SSE cleaning up`);
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
			console.log(`[${connectionId}] SSE cancelled by client`);
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
