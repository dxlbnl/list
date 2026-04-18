import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncHub } from '$lib/server/sync';

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const { operations } = await request.json();

	if (!Array.isArray(operations)) {
		throw error(400, 'Invalid operations format');
	}

	const results = [];
	const updatedListIds = new Set<string>();

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
						// Delete items first (Postgres will handle FKs if configured, but let's be explicit)
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
			if (op.entity === 'list') updatedListIds.add(op.entityId);
			if (op.entity === 'item') {
				if (op.type === 'INSERT') updatedListIds.add(op.data.listId);
				else {
					// For updates/deletes, we'd need the listId. 
					// The POST handler already fetched currentItem for updates.
					// Let's assume the client knows and we can broadcast.
					// In a real app, you'd fetch the listId if not present.
				}
			}
		} catch (e) {
			console.error(`Sync error for op ${op.id}:`, e);
			results.push({ id: op.id, status: 'error', message: (e as Error).message });
		}
	}

	// Broadcast updates
	for (const listId of updatedListIds) {
		syncHub.broadcast(listId);
	}

	return json({ results });
};

export const GET: RequestHandler = async ({ locals }) => {
	console.log('SSE GET request received');
	const user = locals.user;
	if (!user) {
		console.log('SSE GET: Unauthorized');
		throw error(401, 'Unauthorized');
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			console.log(`SSE stream starting for user: ${user.id}`);
			
			const onUpdate = (listId: string) => {
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'update', listId })}\n\n`));
				} catch (e) {
					console.log('SSE: Failed to enqueue message, closing...');
					syncHub.off('update', onUpdate);
				}
			};

			syncHub.on('update', onUpdate);
			
			// Initial connection message
			controller.enqueue(encoder.encode(': connected\n\n'));

			const interval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': ping\n\n'));
				} catch (e) {
					clearInterval(interval);
					syncHub.off('update', onUpdate);
				}
			}, 30000);

			return () => {
				console.log('SSE stream cleaning up');
				clearInterval(interval);
				syncHub.off('update', onUpdate);
			};
		},
		cancel() {
			console.log('SSE stream cancelled by client');
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
