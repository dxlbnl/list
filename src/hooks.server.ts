import { getSession, createAnonymousSession } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	let auth = await getSession(event);

	if (!auth) {
		auth = await createAnonymousSession(event);
	}

	event.locals.user = auth.user;
	event.locals.session = auth.session;

	return resolve(event);
};
