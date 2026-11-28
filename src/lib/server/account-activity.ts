import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { logger } from '$lib/logger';
import type { ListDb } from './ai';
import { aiConnections, lists, listUsers, magicLinks, sessions, users } from './db/schema';

const DAY = 86_400_000;
export const INACTIVITY_DAYS = 90;

export async function recordAccountActivity(db: Pick<ListDb, 'update'>, userId: string, now = new Date()) {
	try {
		await db.update(users).set({ lastActivityAt: now }).where(and(
			eq(users.id, userId),
			or(isNull(users.lastActivityAt), lt(users.lastActivityAt, new Date(now.getTime() - DAY)))
		));
	} catch {
		logger.warn('Could not record List account activity');
	}
}

export async function accountActivityReport(db: Pick<ListDb, 'select'>, now = new Date()) {
	const cutoff = new Date(now.getTime() - INACTIVITY_DAYS * DAY);
	const hasSession = sql`exists (select 1 from ${sessions} where ${sessions.userId} = ${users.id})`;
	const unknown = sql`${users.lastActivityAt} is null`;
	const recent = sql`${users.lastActivityAt} > ${cutoff.toISOString()}::timestamptz`;
	const inactive = sql`${users.lastActivityAt} <= ${cutoff.toISOString()}::timestamptz`;
	const count = (activity: ReturnType<typeof sql>, session: boolean) =>
		sql<number>`count(*) filter (where ${activity} and ${session ? hasSession : sql`not ${hasSession}`})`.mapWith(Number);

	const [totals] = await db.select({
		unknownWithSession: count(unknown, true),
		unknownWithoutSession: count(unknown, false),
		recentWithSession: count(recent, true),
		recentWithoutSession: count(recent, false),
		inactiveWithSession: count(inactive, true),
		inactiveWithoutSession: count(inactive, false)
	}).from(users).where(and(
		isNull(users.email),
		sql`not exists (select 1 from ${lists} where ${lists.createdBy} = ${users.id})`,
		sql`not exists (select 1 from ${listUsers} where ${listUsers.userId} = ${users.id})`,
		sql`not exists (select 1 from ${aiConnections} where ${aiConnections.userId} = ${users.id})`,
		sql`not exists (select 1 from ${magicLinks} where ${and(eq(magicLinks.userIdToMerge, users.id), gt(magicLinks.expiresAt, now))})`
	));

	return { ...totals, generatedAt: now.toISOString(), cutoff: cutoff.toISOString() };
}
