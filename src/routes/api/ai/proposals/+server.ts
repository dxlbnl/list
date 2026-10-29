import { db } from '$lib/server/db';
import { createProposal } from '$lib/server/ai';
import { aiCreateSchema } from '$lib/validations';
import { aiJson, bearer, readBody } from '$lib/server/ai-http';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ request }) => {
 const token = bearer(request);
 const body = await readBody(request, aiCreateSchema);
 return aiJson(await db.transaction((tx) => createProposal(tx, token, body.items)), 201);
};
