import { ACCOUNT_CHANGED_HEADER, ACCOUNT_HEADER, LOCAL_ACCOUNT_COOKIE } from '$lib/account';
import { getSession, createAnonymousSession, setLocalAccountCookie } from '$lib/server/auth';
import { retiredAiResponse } from '$lib/server/ai-http';
import { createSupabaseToken } from '$lib/server/supabase-auth';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { logger } from '$lib/logger';
import { dev } from '$app/environment';
import { getAxiomClient, getAxiomDataset, flush } from '$lib/server/logger';

// Register Axiom transport on the server in production
if (!dev) {
	const axiom = getAxiomClient();
	const dataset = getAxiomDataset();
	if (axiom && dataset) {
		logger._setTransport((payload) => {
			axiom.ingest(dataset, [payload]);
		}, flush);
	}
}

function under(path: string, prefix: string) {
	return path === prefix || path.startsWith(prefix + '/');
}

function oauthEndpoint(path: string) {
	return under(path, '/mcp') || under(path, '/oauth') || path.startsWith('/.well-known/oauth-');
}

function authPath(path: string) {
	return ['/login', '/logout', '/settings', '/api/lists'].some((prefix) => under(path, prefix));
}

function privateResponse(response: Response, browserPage = false) {
	const headers = new Headers(response.headers);
	headers.set('Cache-Control', 'no-store');
	// A native form can send Origin: null under no-referrer, even on the same origin.
	// strict-origin preserves the Origin check without exposing paths or query strings.
	const html = headers.get('Content-Type')?.split(';')[0] === 'text/html';
	headers.set('Referrer-Policy', browserPage && html ? 'strict-origin' : 'no-referrer');
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (under(path, '/reports/account-activity')) return resolve(event);
	if (path === '/ai-openapi.json') return retiredAiResponse();
	if (under(path, '/api/ai')) return resolve(event);
	if (path !== '/oauth/token' && path !== '/oauth/revoke' &&
		['POST', 'PUT', 'PATCH', 'DELETE'].includes(event.request.method) &&
		/^(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)$/i.test(
			event.request.headers.get('content-type')?.split(';')[0].trim() ?? ''
		) && event.request.headers.get('origin') !== event.url.origin) {
		return privateResponse(new Response('Cross-site form submission is forbidden.', { status: 403 }));
	}
	if (oauthEndpoint(path)) {
		const auth = under(path, '/oauth/authorize') ? await getSession(event) : null;
		event.locals.user = auth?.user ?? null;
		event.locals.session = auth?.session ?? null;
		const response = await resolve(event);
		if (!dev) await logger.flush();
		return privateResponse(response, under(path, '/oauth/authorize'));
	}

	const start = Date.now();
	const sessionId = event.cookies.get('auth_session');
	const tAuthStart = Date.now();
	let auth = await getSession(event);
	const expectedAccount = event.request.headers.get(ACCOUNT_HEADER);
	if (under(path, '/api') && expectedAccount && expectedAccount !== auth?.user.id) {
		return privateResponse(new Response(null, { status: 409, headers: { [ACCOUNT_CHANGED_HEADER]: '1' } }));
	}
	let sessionInvalid = false;

	if (!auth && sessionId) {
		sessionInvalid = true;
	}

	if (!auth) {
		auth = await createAnonymousSession(event);
	} else if (event.cookies.get(LOCAL_ACCOUNT_COOKIE) !== auth.user.id) {
		setLocalAccountCookie(event.cookies, auth.user.id);
	}
	const tAuth = Date.now() - tAuthStart;

	event.locals.user = auth.user;
	event.locals.session = auth.session;
	event.locals.sessionInvalid = sessionInvalid;
	
	// Provide a Supabase token for real-time sync
	if (auth.user) {
		event.locals.supabaseToken = await createSupabaseToken(auth.user.id);
	}

	const tResolveStart = Date.now();
	const response = await resolve(event);
	const tResolve = Date.now() - tResolveStart;
	
	const duration = Date.now() - start;
	const loggedPath = event.route.id ?? '<unmatched>';
	
	// Log request summary with detailed tracing
	logger.info(`${event.request.method} ${loggedPath} - ${response.status} (${duration}ms)`, {
		method: event.request.method,
		path: loggedPath,
		status: response.status,
		duration,
		tAuth,
		tResolve,
		userId: event.locals.user?.id
	});

	// Ensure logs are sent to Axiom before Vercel freezes the function
	if (!dev) {
		await logger.flush();
	}

	// Account data in a page or an internal data response can be replayed
	// under a later account if the browser or worker puts it in a shared cache.
	const browserData = !under(path, '/api');
	return authPath(path) || browserData ? privateResponse(response, true) : response;
};

export const handleError: HandleServerError = async ({ error, event, status }) => {
	const path = event.route.id ?? '<unmatched>';
	const errorKind = error instanceof TypeError ? 'type_error'
		: error instanceof RangeError ? 'range_error'
		: error instanceof SyntaxError ? 'syntax_error'
		: error instanceof Error ? 'application_error'
		: 'unknown_error';
	logger.error(`Unhandled server error: ${path}`, {
		path,
		status,
		errorKind,
		userId: event.locals.user?.id
	});

	if (!dev) {
		await logger.flush();
	}

	return {
		message: 'An unexpected error occurred.',
		code: 'INTERNAL_SERVER_ERROR'
	};
};
