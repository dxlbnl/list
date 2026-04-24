import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		supabaseToken: locals.supabaseToken,
		sessionInvalid: locals.sessionInvalid
	};
};
