import { json } from '@sveltejs/kit';
import { oauthConfig, protectedResource } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => json(protectedResource(oauthConfig(url.origin)));
