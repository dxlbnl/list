import { readLocalMergeCookie } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const previousAnonymousAccount = readLocalMergeCookie(cookies, locals.session?.id);
	return {
		user: locals.user,
		supabaseToken: locals.supabaseToken,
		sessionInvalid: locals.sessionInvalid,
		...(previousAnonymousAccount ? { previousAnonymousAccount } : {})
	};
};
