import { createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/logger';
import { accountActivityReport, INACTIVITY_DAYS } from '$lib/server/account-activity';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

const securityHeaders = {
	'Cache-Control': 'private, no-store',
	'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
	'Referrer-Policy': 'no-referrer',
	'X-Robots-Tag': 'noindex, nofollow'
};

function authorized(authorization: string | null, secret: string) {
	const match = /^Basic ([A-Za-z0-9+/]+=*)$/i.exec(authorization ?? '');
	if (!match) return false;
	const credentials = Buffer.from(match[1], 'base64').toString('utf8');
	const hash = (value: string) => createHash('sha256').update(value).digest();
	return timingSafeEqual(hash(credentials), hash(`report:${secret}`));
}

export const GET: RequestHandler = async ({ request }) => {
	const secret = env.LIST_ACTIVITY_REPORT_SECRET;
	if (!secret) return new Response('Not found', { status: 404, headers: securityHeaders });
	if (!authorized(request.headers.get('authorization'), secret)) {
		return new Response('Report credentials required', {
			status: 401,
			headers: { ...securityHeaders, 'WWW-Authenticate': 'Basic realm="List account activity", charset="UTF-8"' }
		});
	}

	try {
		const report = await accountActivityReport(db);
		return new Response(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>List account activity</title>
<style>
	body { margin: 3rem auto; padding: 0 1rem; max-width: 44rem; font: 1rem/1.55 system-ui, sans-serif; color-scheme: light dark; }
	table { width: 100%; border-collapse: collapse; }
	th, td { padding: .5rem; border-bottom: 1px solid GrayText; text-align: right; }
	th:first-child { text-align: left; }
	time { font-variant-numeric: tabular-nums; }
</style>
<main>
<h1>Account activity</h1>
<p>Generated at <time>${report.generatedAt}</time>.</p>
<p>Anonymous accounts without owned lists, shared memberships, AI connections or valid sign-in links.</p>
<table>
	<thead><tr><th scope="col">Activity</th><th scope="col">With a session</th><th scope="col">Without a session</th></tr></thead>
	<tbody>
	<tr><th scope="row">Unknown</th><td>${report.unknownWithSession}</td><td>${report.unknownWithoutSession}</td></tr>
	<tr><th scope="row">Active in the last ${INACTIVITY_DAYS} days</th><td>${report.recentWithSession}</td><td>${report.recentWithoutSession}</td></tr>
	<tr><th scope="row">Inactive at least ${INACTIVITY_DAYS} days</th><td>${report.inactiveWithSession}</td><td>${report.inactiveWithoutSession}</td></tr>
	</tbody>
</table>
<p><strong>${report.inactiveWithoutSession}</strong> potential cleanup candidates. The inactivity cutoff is <time>${report.cutoff}</time>.</p>
</main>
</html>`, { headers: { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
	} catch {
		logger.error('Account activity report unavailable');
		return new Response('Report temporarily unavailable', { status: 503, headers: securityHeaders });
	} finally {
		await logger.flush();
	}
};
