import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	// Clear the session cookie with matching flags
	cookies.delete('auth_session', { 
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev
	});
	
	// Redirect to home
	throw redirect(303, '/');
};
