import { db } from '$lib/server/db';
import { oauthConfig, revokeOAuthToken } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, url }) => revokeOAuthToken(db, oauthConfig(url.origin), request);
