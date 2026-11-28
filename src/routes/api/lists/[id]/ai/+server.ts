import { db } from '$lib/server/db';
import { pendingProposals } from '$lib/server/ai';
import { aiJson } from '$lib/server/ai-http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const proposals = await db.transaction((tx) => pendingProposals(tx, params.id, locals.user?.id));
	return aiJson({ proposals });
};
