import { db } from '$lib/server/db';
import { magicLinks } from '$lib/server/db/schema';
import { nanoid } from '$lib/utils';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, url }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	const token = nanoid();
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

	await db.insert(magicLinks).values({
		token,
		email: null,
		userIdToMerge: user.id,
		expiresAt
	});

	const cloneUrl = `${url.origin}/login/confirm/${token}`;

	return json({ url: cloneUrl });
};
