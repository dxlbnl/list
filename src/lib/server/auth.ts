import { LOCAL_ACCOUNT_COOKIE } from '$lib/account';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
			user: { id: users.id, email: users.email, email_verified: users.email_verified, createdAt: users.createdAt }
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, sessionId));

	if (result.length === 0) {
		logger.warn('Session cookie present but session not found in DB');
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

	await db.insert(users).values({ ...userValues, lastActivityAt: userValues.createdAt });

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

	setLocalAccountCookie(event.cookies, userId);

	logger.info('Created anonymous session', { userId });

	return {
		session: { id: sessionId, userId },
		user: userValues
	};
}
import { lists, listUsers } from '$lib/server/db/schema';
import { and, inArray } from 'drizzle-orm';

export async function mergeUsers(sourceUserId: string, targetUserId: string, anonymousOnly = false) {
	if (sourceUserId === targetUserId) return;

	return db.transaction(async (tx) => {
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
		return true;
	});
}


export function setLocalAccountCookie(cookies: RequestEvent['cookies'], account: string) {
	cookies.set(LOCAL_ACCOUNT_COOKIE, account, {
		path: '/', expires: new Date('9999-12-31'), httpOnly: false, sameSite: 'lax', secure: !dev
	});
}

const LOCAL_MERGE_COOKIE = 'list_local_merge';

function signLocalMerge(source: string, sessionId: string) {
	return createHmac('sha256', sessionId).update('list-local-merge:').update(source).digest();
}

export function setLocalMergeCookie(cookies: RequestEvent['cookies'], source: string, sessionId: string) {
	const sourceKey = Buffer.from(source).toString('base64url');
	cookies.set(LOCAL_MERGE_COOKIE, `${sourceKey}.${signLocalMerge(sourceKey, sessionId).toString('base64url')}`, {
		path: '/', maxAge: 120, httpOnly: true, sameSite: 'lax', secure: !dev
	});
}

export function readLocalMergeCookie(cookies: RequestEvent['cookies'], sessionId?: string) {
	const value = cookies.get(LOCAL_MERGE_COOKIE);
	if (!value || !sessionId) return;
	const [source, signature, extra] = value.split('.');
	if (!source || !signature || extra !== undefined) return;
	const expected = signLocalMerge(source, sessionId);
	const actual = Buffer.from(signature, 'base64url');
	if (actual.length === expected.length && timingSafeEqual(expected, actual)) {
		return Buffer.from(source, 'base64url').toString();
	}
}
