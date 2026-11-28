import { expect, it } from 'vitest';
import { createTestDb } from '$lib/test/pglite';
import { accountActivityReport, recordAccountActivity } from './account-activity';
import { sessions, users } from './db/schema';

it('keeps unmeasured accounts separate and records activity at most daily', async () => {
	const handle = await createTestDb();
	try {
		const now = new Date('2026-11-28T00:00:00Z');
		const inactive = new Date('2026-08-30T00:00:00Z');
		await handle.db.insert(users).values([
			{ id: 'unknown' },
			{ id: 'inactive', lastActivityAt: inactive },
			{ id: 'with-session', lastActivityAt: inactive },
			{ id: 'registered', email: 'example@example.test', lastActivityAt: inactive }
		]);
		await handle.db.insert(sessions).values({ id: 'session', userId: 'with-session' });
		expect(await accountActivityReport(handle.db, now)).toMatchObject({
			unknownWithoutSession: 1, inactiveWithoutSession: 1, inactiveWithSession: 1
		});
		await recordAccountActivity(handle.db, 'unknown', now);
		await recordAccountActivity(handle.db, 'unknown', new Date('2026-11-28T12:00:00Z'));
		expect((await handle.db.select().from(users)).find(({ id }) => id === 'unknown')?.lastActivityAt).toEqual(now);
		expect(await accountActivityReport(handle.db, now)).toMatchObject({ unknownWithoutSession: 0, recentWithoutSession: 1 });
	} finally {
		await handle.close();
	}
}, 30_000);
