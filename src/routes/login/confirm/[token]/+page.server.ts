import { db } from '$lib/server/db';
import { users, sessions, magicLinks } from '$lib/server/db/schema';
import { mergeUsers } from '$lib/server/auth';
import { nanoid } from '$lib/utils';
import { eq } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import { dev } from '$app/environment';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { token } = params;

	const result = await db
		.select()
		.from(magicLinks)
		.where(eq(magicLinks.token, token));

	if (result.length === 0) {
		throw error(400, MESSAGES.AUTH.INVALID_TOKEN);
	}

	const link = result[0];
	if (Date.now() >= link.expiresAt.getTime()) {
		await db.delete(magicLinks).where(eq(magicLinks.token, token));
		throw error(400, MESSAGES.AUTH.EXPIRED_TOKEN);
	}

	return { token };
};

export const actions: Actions = {
	default: async ({ params, cookies, locals }) => {
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

		let targetUserId: string;
		const currentUserId = locals.user?.id;
		
		if (link.email) {
			// 1. Check if user with this email already exists
			const existingUser = await db
				.select()
				.from(users)
				.where(eq(users.email, link.email));

			if (existingUser.length > 0) {
				targetUserId = existingUser[0].id;

				// 2. Merge anonymous data if applicable
				if (link.userIdToMerge) {
					await mergeUsers(link.userIdToMerge, targetUserId);
				}
			} else {
				// 3. Convert anonymous user to registered user
				if (link.userIdToMerge) {
					targetUserId = link.userIdToMerge;
					await db
						.update(users)
						.set({
							email: link.email,
							email_verified: true
						})
						.where(eq(users.id, targetUserId));
				} else {
					// Fallback: Create new user
					targetUserId = nanoid();
					await db.insert(users).values({
						id: targetUserId,
						email: link.email,
						email_verified: true
					});
				}
			}
		} else if (link.userIdToMerge) {
			// Session Cloning Case: No email, just a userId to clone
			targetUserId = link.userIdToMerge;
			
			// If the scanning device has an anonymous session, merge its data into the cloned account
			if (currentUserId && currentUserId !== targetUserId) {
				await mergeUsers(currentUserId, targetUserId);
			}
		} else {
			throw error(400, MESSAGES.AUTH.CONTEXT_MISSING);
		}

		// 4. Create new session
		const sessionId = nanoid();
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
			secure: !dev
		});

		// 7. Notify other sessions for this user to pull new lists
		const { syncHub } = await import('$lib/server/sync');
		syncHub.emit(`user:${targetUserId}`, { listId: 'global' });

		throw redirect(303, '/login/confirmed');
	}
};
