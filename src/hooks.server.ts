import { getSession, createAnonymousSession } from '$lib/server/auth';
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

export const handle: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	
	const tAuthStart = Date.now();
	let auth = await getSession(event);

	if (!auth) {
		auth = await createAnonymousSession(event);
	}
	const tAuth = Date.now() - tAuthStart;

	event.locals.user = auth.user;
	event.locals.session = auth.session;

	const tResolveStart = Date.now();
	const response = await resolve(event);
	const tResolve = Date.now() - tResolveStart;
	
	const duration = Date.now() - start;
	
	// Log request summary with detailed tracing
	logger.info(`${event.request.method} ${event.url.pathname} - ${response.status} (${duration}ms)`, {
		method: event.request.method,
		path: event.url.pathname,
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

	return response;
};

export const handleError: HandleServerError = async ({ error, event }) => {
	logger.error(`Unhandled server error: ${event.url.pathname}`, {
		path: event.url.pathname,
		userId: event.locals.user?.id
	}, error);

	if (!dev) {
		await logger.flush();
	}

	return {
		message: 'An unexpected error occurred.',
		code: 'INTERNAL_SERVER_ERROR'
	};
};
