import { db } from '$lib/server/db';
import { exchangeOAuthToken, oauthConfig } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, url }) => exchangeOAuthToken(db, oauthConfig(url.origin), request);
