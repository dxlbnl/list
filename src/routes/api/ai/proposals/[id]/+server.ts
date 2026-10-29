import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { agentProposal, patchProposal, publicProposal } from '$lib/server/ai';
import { aiPatchSchema } from '$lib/validations';
import { aiJson, bearer, editToken, readBody } from '$lib/server/ai-http';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ request, params }) => {
 const row = await db.transaction((tx) => agentProposal(tx, bearer(request), params.id, editToken(request)));
 return aiJson(publicProposal(row));
};
export const PATCH: RequestHandler = async ({ request, params }) => {
 const token = bearer(request), edit = editToken(request);
 const body = await readBody(request, aiPatchSchema);
 const row = await db.transaction((tx) => patchProposal(tx, token, params.id, edit, body.version, body.items));
 if (!row) error(409, 'Proposal closed, expired or version changed; GET current state');
 return aiJson(row);
};
