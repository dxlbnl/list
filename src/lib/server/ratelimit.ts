import { db } from '$lib/server/db';
import { rateLimits } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '$lib/logger';

/**
 * Checks if a request should be rate limited.
 * Returns true if allowed, false if limited.
 */
export async function checkRateLimit(key: string, limit: number, windowMinutes: number): Promise<boolean> {
	const now = new Date();
	
	// 1. Get current limit record
	const record = await db.query.rateLimits.findFirst({
		where: eq(rateLimits.key, key)
	});

	if (!record || now > record.resetAt) {
		// Reset window: Update or Insert new record
		const resetAt = new Date(now.getTime() + windowMinutes * 60 * 1000);
		
		await db
			.insert(rateLimits)
			.values({
				key,
				count: 1,
				resetAt
			})
			.onConflictDoUpdate({
				target: rateLimits.key,
				set: {
					count: 1,
					resetAt
				}
			});
		
		return true;
	}

	if (record.count >= limit) {
		logger.warn('Rate limit exceeded', { key, limit, count: record.count });
		return false;
	}

	// Increment count
	await db
		.update(rateLimits)
		.set({
			count: sql`${rateLimits.count} + 1`
		})
		.where(eq(rateLimits.key, key));

	return true;
}
