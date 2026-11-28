import { db } from '$lib/server/db';
import { users, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { logger } from '$lib/logger';

const SESSION_COOKIE_NAME = 'auth_session';

export async function getSession(event: RequestEvent) {
	const sessionId = event.cookies.get(SESSION_COOKIE_NAME);
	if (!sessionId) return null;

	const result = await db
		.select({
			session: sessions,
			user: users
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId));

	if (result.length === 0) {
		logger.warn('Session cookie present but session not found in DB', { sessionId });
		return null;
	}

	const { session, user } = result[0];

	return { session, user };
}

import { nanoid } from '$lib/utils';

export async function createAnonymousSession(event: RequestEvent) {
	const userId = nanoid();
	const sessionId = nanoid();
	// True permanence for persistent cookie
	const farFuture = new Date('9999-12-31');

	const userValues = {
		id: userId,
		email: null,
		email_verified: false,
		createdAt: new Date()
	};

	await db.insert(users).values(userValues);

	await db.insert(sessions).values({
		id: sessionId,
		userId
	});

	event.cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: '/',
		expires: farFuture,
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev
	});

	logger.info('Created anonymous session', { userId, sessionId });

	return {
		session: { id: sessionId, userId },
		user: userValues
	};
}
import { lists, listUsers } from '$lib/server/db/schema';
import { and, inArray } from 'drizzle-orm';

export async function mergeUsers(sourceUserId: string, targetUserId: string, anonymousOnly = false) {
	if (sourceUserId === targetUserId) return;

	await db.transaction(async (tx) => {
		if (anonymousOnly) {
			const [source] = await tx.select({ email: users.email }).from(users)
				.where(eq(users.id, sourceUserId)).for('update');
			if (source?.email !== null) return;
		}

		logger.info('Merging users', { sourceUserId, targetUserId });

		// 1. Transfer list ownership
		const anonLists = await tx
			.select()
			.from(lists)
			.where(eq(lists.createdBy, sourceUserId));

		for (const listRecord of anonLists) {
			let newSlug = listRecord.slug;

			// Check for slug collision for the target user
			const collision = await tx
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
			await tx
				.update(lists)
				.set({ createdBy: targetUserId, slug: newSlug })
				.where(eq(lists.id, listRecord.id));
		}

		// 2. Transfer shared list access
		// Delete source access where the target user already has access
		const targetAccessSubquery = tx
			.select({ listId: listUsers.listId })
			.from(listUsers)
			.where(eq(listUsers.userId, targetUserId));

		await tx
			.delete(listUsers)
			.where(
				and(
					eq(listUsers.userId, sourceUserId),
					inArray(listUsers.listId, targetAccessSubquery)
				)
			);

		// Transfer remaining access
		await tx
			.update(listUsers)
			.set({ userId: targetUserId })
			.where(eq(listUsers.userId, sourceUserId));

		// 3. Finally, delete the source user
		await tx.delete(users).where(eq(users.id, sourceUserId));

		logger.info('User merge complete', { sourceUserId, targetUserId, listsMerged: anonLists.length });
	});
}
