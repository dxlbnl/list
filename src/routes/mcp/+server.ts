import { db } from '$lib/server/db';
import { createListMcpHandler } from '$lib/server/mcp';
import { oauthConfig } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

const mcp = createListMcpHandler(db);
export const POST: RequestHandler = ({ request, url }) => mcp(request, oauthConfig(url.origin));
export const GET: RequestHandler = () => new Response(null, { status: 405, headers: { Allow: 'POST' } });
export const DELETE = GET;
