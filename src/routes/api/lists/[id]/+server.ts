import { recordAccountActivity } from '$lib/server/account-activity';
import { logger } from '$lib/logger';
import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const listId = params.id;

	const [result] = await db
		.select({ list: lists, memberId: listUsers.userId })
		.from(lists)
		.leftJoin(listUsers, and(eq(listUsers.listId, lists.id), eq(listUsers.userId, user.id)))
		.where(eq(lists.id, listId));

	if (!result) throw error(404, 'List not found');
	if (result.memberId === null) throw error(403, 'Forbidden');

	const [itemData] = await Promise.all([
		db.query.items.findMany({ where: eq(items.listId, listId) }),
		recordAccountActivity(db, user.id)
	]);
	await logger.flush();
	return json({
		list: result.list,
		items: itemData
	});
};
