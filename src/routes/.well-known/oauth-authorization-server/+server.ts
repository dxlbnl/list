import { json } from '@sveltejs/kit';
import { authorizationMetadata, oauthConfig } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => json(authorizationMetadata(oauthConfig(url.origin)));
