import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sessions } from '$lib/server/db/schema';
import { logger } from '$lib/logger';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

// A page loaded before the POST rollout still navigates to GET /logout.
export const GET: RequestHandler = () => new Response(
	`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign out</title></head>
<body>
	<main>
		<h1>Sign out</h1>
		<form method="post"><button type="submit">Sign out</button></form>
		<a href="/">Cancel</a>
	</main>
</body>
</html>`,
	{ headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' } }
);

export const POST: RequestHandler = async ({ cookies, request, url }) => {
	if (request.headers.get('origin') !== url.origin) {
		return new Response('Cross-site form submission is forbidden.', { status: 403 });
	}

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
	if (request.headers.get('accept') === 'application/json') {
		return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
	}
	throw redirect(303, '/');
};
