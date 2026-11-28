import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import { logger } from '$lib/logger';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('auth_session');
	if (sessionId) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}

	// Clear the session cookie with matching flags
	cookies.delete('auth_session', { 
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev
	});
	
	await logger.flush();
	// Redirect to home
	throw redirect(303, '/');
};
