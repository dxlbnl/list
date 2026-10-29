import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { decideProposal } from '$lib/server/ai';
import { aiDecisionSchema } from '$lib/validations';
import { aiJson, readBody, sameOrigin } from '$lib/server/ai-http';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ params, locals, request, url }) => {
 sameOrigin(request, url);
 const body = await readBody(request, aiDecisionSchema);
 const result = await db.transaction((tx) => decideProposal(tx, params.id, locals.user?.id, params.proposalId, body.version, body.decision));
 if (!result) error(409, 'Proposal closed, expired or version changed; refresh before reviewing');
 return aiJson(result);
};
