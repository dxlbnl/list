import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
	// Clear the session cookie
	cookies.delete('auth_session', { path: '/' });
	
	// Redirect to home
	throw redirect(303, '/');
};
