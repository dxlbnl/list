import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { decideProposal, ProposalGroupConflict } from '$lib/server/ai';
import { aiDecisionSchema } from '$lib/validations';
import { aiJson, readBody, sameOrigin } from '$lib/server/ai-http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals, request, url }) => {
	sameOrigin(request, url);
	const body = await readBody(request, aiDecisionSchema);
	try {
		const result = await db.transaction((tx) => decideProposal(tx, params.id, locals.user?.id, params.proposalId, body));
		if (!result) error(409, 'Proposal closed, expired or version changed; refresh before reviewing');
		return aiJson(result);
	} catch (cause) {
		if (!(cause instanceof ProposalGroupConflict)) throw cause;
		return aiJson({ code: 'GROUP_CHANGED', missingGroups: cause.missingGroups, groups: cause.groups }, 409);
	}
};
