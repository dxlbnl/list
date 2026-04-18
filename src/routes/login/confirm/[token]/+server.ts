import { db } from '$lib/server/db';
import { users, sessions, magicLinks, lists } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const { token } = params;

	const result = await db
		.select()
		.from(magicLinks)
		.where(eq(magicLinks.token, token));

	if (result.length === 0) {
		throw error(400, 'Invalid or expired magic link');
	}

	const link = result[0];
	if (Date.now() >= link.expiresAt.getTime()) {
		await db.delete(magicLinks).where(eq(magicLinks.token, token));
		throw error(400, 'Magic link has expired');
	}

	// 1. Check if user with this email already exists
	const existingUser = await db
		.select()
		.from(users)
		.where(eq(users.email, link.email));

	let targetUserId: string;

	if (existingUser.length > 0) {
		targetUserId = existingUser[0].id;

		// 2. Merge anonymous data if applicable
		if (link.userIdToMerge && link.userIdToMerge !== targetUserId) {
			// Move lists
			await db
				.update(lists)
				.set({ createdBy: targetUserId })
				.where(eq(lists.createdBy, link.userIdToMerge));

			// Optional: We could delete the anonymous user here, 
			// but we'll leave it for now or rely on cleanup.
		}
	} else {
		// 3. Convert anonymous user to registered user
		if (link.userIdToMerge) {
			targetUserId = link.userIdToMerge;
			await db
				.update(users)
				.set({
					email: link.email,
					emailVerified: true
				})
				.where(eq(users.id, targetUserId));
		} else {
			// Fallback: Create new user
			targetUserId = crypto.randomUUID();
			await db.insert(users).values({
				id: targetUserId,
				email: link.email,
				emailVerified: true
			});
		}
	}

	// 4. Create new session
	const sessionId = crypto.randomUUID();
	const farFuture = new Date('9999-12-31');

	await db.insert(sessions).values({
		id: sessionId,
		userId: targetUserId
	});

	// 5. Cleanup
	await db.delete(magicLinks).where(eq(magicLinks.token, token));

	// 6. Set cookie
	cookies.set('auth_session', sessionId, {
		path: '/',
		expires: farFuture,
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	});

	throw redirect(303, '/');
};
