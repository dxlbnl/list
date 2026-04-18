import { db } from '$lib/server/db';
import { users, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

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

	if (result.length === 0) return null;

	const { session, user } = result[0];

	return { session, user };
}

import { nanoid } from '$lib/utils';

export async function createAnonymousSession(event: RequestEvent) {
	const userId = nanoid();
	const sessionId = nanoid();
	// True permanence for persistent cookie
	const farFuture = new Date('9999-12-31');

	await db.insert(users).values({
		id: userId,
		email: null,
		emailVerified: false
	});

	await db.insert(sessions).values({
		id: sessionId,
		userId
	});

	event.cookies.set(SESSION_COOKIE_NAME, sessionId, {
		path: '/',
		expires: farFuture,
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production'
	});

	return {
		session: { id: sessionId, userId },
		user: { id: userId, email: null, emailVerified: false }
	};
}
