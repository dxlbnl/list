import { db } from '$lib/server/db';
import { users, sessions, magicLinks, lists, listUsers } from '$lib/server/db/schema';
import { nanoid } from '$lib/utils';
import { eq, and, inArray } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params }) => {
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

	return { token };
};

export const actions: Actions = {
	default: async ({ params, cookies }) => {
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
		
		if (link.email) {
			// 1. Check if user with this email already exists
			const existingUser = await db
				.select()
				.from(users)
				.where(eq(users.email, link.email));

			if (existingUser.length > 0) {
				targetUserId = existingUser[0].id;

				// 2. Merge anonymous data if applicable
				if (link.userIdToMerge && link.userIdToMerge !== targetUserId) {
					const anonLists = await db
						.select()
						.from(lists)
						.where(eq(lists.createdBy, link.userIdToMerge));

					for (const listRecord of anonLists) {
						let newSlug = listRecord.slug;
						
						// Check for slug collision for the target user
						const collision = await db
							.select()
							.from(lists)
							.where(
								and(
									eq(lists.createdBy, targetUserId), 
									eq(lists.slug, newSlug)
								)
							);

						if (collision.length > 0) {
							newSlug = `${newSlug}-${nanoid(4)}`;
						}

						// Update list ownership and slug
						await db
							.update(lists)
							.set({ createdBy: targetUserId, slug: newSlug })
							.where(eq(lists.id, listRecord.id));
					}

					// Transfer shared list access
					// 1. Delete anonymous access where the target user already has access
					const anonAccessSubquery = db
						.select({ listId: listUsers.listId })
						.from(listUsers)
						.where(eq(listUsers.userId, targetUserId));

					await db
						.delete(listUsers)
						.where(
							and(
								eq(listUsers.userId, link.userIdToMerge),
								inArray(listUsers.listId, anonAccessSubquery)
							)
						);

					// 2. Transfer remaining access
					await db
						.update(listUsers)
						.set({ userId: targetUserId })
						.where(eq(listUsers.userId, link.userIdToMerge));

					// 3. Finally, delete the anonymous user
					await db.delete(users).where(eq(users.id, link.userIdToMerge));
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
		} else {
			throw error(400, 'Invalid magic link: no email or user to merge');
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
