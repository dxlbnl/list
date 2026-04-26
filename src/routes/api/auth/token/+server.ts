import { createSupabaseToken } from '$lib/server/supabase-auth';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const token = await createSupabaseToken(locals.user.id);
	return json({ token });
};
