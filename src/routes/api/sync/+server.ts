import { db } from '$lib/server/db';
import { error, json } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import type { RequestHandler } from './$types';
import { syncRequestSchema } from '$lib/validations';
import { logger } from '$lib/logger';
import { processSyncBatch } from '$lib/server/sync';

const syncLogger = logger.child({ module: 'sync' });

// Missing values, invalid data and check constraints are input failures. In particular,
// keep unique and foreign-key conflicts retryable because concurrent writes can cause them.
const permanentInputFailures = new Set(['22003', '22007', '22021', '22P02', '23502', '23514']);

function isPermanentInputFailure(cause: unknown): boolean {
	if (typeof cause !== 'object' || cause === null) return false;
	const databaseError = 'cause' in cause && cause.cause ? cause.cause : cause;
	return typeof databaseError === 'object' && databaseError !== null
		&& 'code' in databaseError && typeof databaseError.code === 'string'
		&& permanentInputFailures.has(databaseError.code);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, MESSAGES.AUTH.UNAUTHORIZED);

	const body = await request.json();
	const validation = syncRequestSchema.safeParse(body);

	if (!validation.success) {
		syncLogger.error('Sync validation failed', { error: validation.error.message, userId: user.id });
		throw error(400, `${MESSAGES.DATA.PROCESS_ERROR}: ${validation.error.message}`);
	}

	const { operations, clientId, cursor } = validation.data;
	syncLogger.info(`Processing ${operations.length} operations`, { userId: user.id, count: operations.length, clientId });

	const tStart = performance.now();

	try {
		const { results, changes, cursor: nextCursor } = await processSyncBatch(db, user.id, operations, cursor);

		const tTotal = performance.now() - tStart;
		const ignoredCount = results.filter((r) => r.status === 'ignored').length;
		syncLogger.info(`Atomic Sync complete`, { tTotal: tTotal.toFixed(2), opCount: operations.length, ignoredCount });

		return json({ results, changes, cursor: nextCursor });
	} catch (e) {
		if (isPermanentInputFailure(e)) {
			syncLogger.warn('Sync input was rejected by the database', { userId: user.id });
			throw error(422, 'One or more sync operations contain invalid data.');
		}
		syncLogger.error('Sync failed', { userId: user.id, error: e instanceof Error ? e.name : 'Unknown error' });
		throw error(500, MESSAGES.DATA.PROCESS_ERROR);
	}
};
