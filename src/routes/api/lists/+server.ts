import { db } from '$lib/server/db';
import { lists, listUsers } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const userLists = await db
		.select({
			id: lists.id,
			slug: lists.slug,
			name: lists.name,
			createdBy: lists.createdBy,
			createdAt: lists.createdAt
		})
		.from(lists)
		.innerJoin(listUsers, eq(lists.id, listUsers.listId))
		.where(eq(listUsers.userId, user.id));

	return json({ lists: userLists });
};
