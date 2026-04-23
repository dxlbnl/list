import { db } from '$lib/server/db';
import { rateLimits } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '$lib/logger';

/**
 * Checks if a request should be rate limited.
 * Returns true if allowed, false if limited.
 * Uses an atomic UPSERT to prevent race conditions.
 */
export async function checkRateLimit(key: string, limit: number, windowMinutes: number): Promise<boolean> {
	const now = new Date();
	const resetAt = new Date(now.getTime() + windowMinutes * 60 * 1000);

	// Atomic UPSERT:
	// 1. If key doesn't exist, insert with count=1.
	// 2. If key exists but resetAt is in the past, reset count=1 and update resetAt.
	// 3. If key exists and resetAt is in the future, increment count.
	const [record] = await db
		.insert(rateLimits)
		.values({
			key,
			count: 1,
			resetAt
		})
		.onConflictDoUpdate({
			target: rateLimits.key,
			set: {
				count: sql`CASE WHEN rate_limits.reset_at < ${now.toISOString()} THEN 1 ELSE rate_limits.count + 1 END`,
				resetAt: sql`CASE WHEN rate_limits.reset_at < ${now.toISOString()} THEN ${resetAt.toISOString()} ELSE rate_limits.reset_at END`
			}
		})
		.returning();

	if (record.count > limit) {
		logger.warn('Rate limit exceeded', { key, limit, count: record.count });
		return false;
	}

	return true;
}
