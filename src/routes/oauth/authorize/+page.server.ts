import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { sameOrigin } from '$lib/server/ai-http';
import {
	beginOAuthConsent, finishOAuthConsent, getOAuthConsent, matchesOAuthSession,
	oauthConfig, oauthCookie, oauthCookieOptions
} from '$lib/server/oauth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, locals, url }) => {
	const config = oauthConfig(url.origin);
	if (url.search) {
		const result = await beginOAuthConsent(db, config, url, locals.session?.id);
		if ('location' in result) redirect(303, result.location!);
		cookies.set(oauthCookie, result.ticket!, oauthCookieOptions);
		redirect(303, '/oauth/authorize');
	}
	const pending = await getOAuthConsent(db, cookies.get(oauthCookie));
	if (!pending) error(400, 'This connection request expired. Start again in your AI app.');
	const client = config.clients.find(({ id }) => id === pending.clientId);
	if (!client) error(400, 'This connection request is unavailable.');
	const signedIn = matchesOAuthSession(pending, locals.session?.id);
	if (pending.sessionHash && !signedIn) error(400, 'Your List session changed. Start again in your AI app.');
	return {
		clientName: client.name,
		scopes: pending.query.scope.split(' '),
		signedIn,
		intent: signedIn ? pending.hash : null
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url, cookies }) => {
		sameOrigin(request, url);
		const ticket = cookies.get(oauthCookie);
		if (!ticket || !locals.session || !locals.user) error(400, 'Start the connection again in your AI app.');
		const form = await request.formData();
		const intent = form.get('intent');
		const decision = form.get('decision');
		if (typeof intent !== 'string' || (decision !== 'allow' && decision !== 'deny')) {
			error(400, 'Choose whether to allow access.');
		}
		const location = await finishOAuthConsent(
			db, oauthConfig(url.origin), ticket, intent, locals.session.id, locals.user.id, decision === 'allow'
		);
		cookies.delete(oauthCookie, { path: '/' });
		redirect(303, location);
	}
};
