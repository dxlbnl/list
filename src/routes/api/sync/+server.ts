import { db } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import type { RequestHandler } from './$types';
import { syncRequestSchema } from '$lib/validations';
import { logger } from '$lib/logger';
import { processSyncBatch } from '$lib/server/sync';

const syncLogger = logger.child({ module: 'sync' });

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, MESSAGES.AUTH.UNAUTHORIZED);

	const body = await request.json();
	const validation = syncRequestSchema.safeParse(body);

	if (!validation.success) {
		syncLogger.error('Sync validation failed', { error: validation.error.message, userId: user.id });
		throw error(400, `${MESSAGES.DATA.PROCESS_ERROR}: ${validation.error.message}`);
	}

	const { operations, clientId } = validation.data;
	syncLogger.info(`Processing ${operations.length} operations`, { userId: user.id, count: operations.length, clientId });

	const tStart = performance.now();

	try {
		const { results } = await processSyncBatch(db, user.id, operations);

		const tTotal = performance.now() - tStart;
		const ignoredCount = results.filter((r) => r.status === 'ignored').length;
		syncLogger.info(`Atomic Sync complete`, { tTotal: tTotal.toFixed(2), opCount: operations.length, ignoredCount });

		return json({ results });
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		syncLogger.error('Sync failed', { userId: user.id, error: message });
		throw error(500, `${MESSAGES.DATA.PROCESS_ERROR}: ${message}`);
	}
};
