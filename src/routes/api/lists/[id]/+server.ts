import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const listId = params.id;

	// Verify access
	const access = await db
		.select()
		.from(listUsers)
		.where(and(eq(listUsers.listId, listId), eq(listUsers.userId, user.id)));
	
	if (access.length === 0) {
		throw error(403, 'Forbidden');
	}

	const listData = await db.query.lists.findFirst({
		where: eq(lists.id, listId)
	});

	if (!listData) throw error(404, 'List not found');

	const itemData = await db.query.items.findMany({
		where: eq(items.listId, listId)
	});

	return json({
		list: listData,
		items: itemData
	});
};
