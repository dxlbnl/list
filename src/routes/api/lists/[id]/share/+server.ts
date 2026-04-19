import { db } from '$lib/server/db';
import { lists, listUsers, listInvites } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import { nanoid } from '$lib/utils';
import { shareListRequestSchema } from '$lib/validations';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request, url }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const body = await request.json();
	const validation = shareListRequestSchema.safeParse(body);

	if (!validation.success) {
		throw error(400, `Invalid request: ${validation.error.message}`);
	}

	const { expiresAt } = validation.data;
	const listId = params.id;

	// Verify access
	const access = await db
		.select()
		.from(listUsers)
		.where(and(eq(listUsers.listId, listId), eq(listUsers.userId, user.id)));
	
	if (access.length === 0) {
		throw error(403, 'Forbidden');
	}

	const list = await db.query.lists.findFirst({
		where: eq(lists.id, listId)
	});

	if (!list) throw error(404, 'List not found');

	const token = nanoid(12);
	const expiryDate = expiresAt ? new Date(expiresAt) : null;

	await db.insert(listInvites).values({
		token,
		listId,
		expiresAt: expiryDate
	});

	const joinUrl = `${url.origin}/join/${list.slug}/${token}`;

	return json({ url: joinUrl });
};
