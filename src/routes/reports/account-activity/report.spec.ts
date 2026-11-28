import { expect, it, vi } from 'vitest';
import { GET } from './+server';

const fixture = vi.hoisted(() => ({
	env: { LIST_ACTIVITY_REPORT_SECRET: '' },
	report: vi.fn(async () => ({
		generatedAt: '2026-11-28T00:00:00Z', cutoff: '2026-08-30T00:00:00Z',
		unknownWithSession: 0, unknownWithoutSession: 0,
		recentWithSession: 0, recentWithoutSession: 0,
		inactiveWithSession: 2, inactiveWithoutSession: 1
	}))
}));
vi.mock('$env/dynamic/private', () => ({ env: fixture.env }));
vi.mock('$lib/server/account-activity', () => ({ accountActivityReport: fixture.report, INACTIVITY_DAYS: 90 }));
vi.mock('$lib/server/db', () => ({ db: {} }));

it('requires configured Basic credentials before querying and returns an uncached aggregate page', async () => {
	const send = (authorization?: string) => GET({
		request: new Request('https://list.example.test/reports/account-activity', {
			headers: authorization ? { authorization } : undefined
		})
	} as Parameters<typeof GET>[0]);
	expect((await send()).status).toBe(404);
	fixture.env.LIST_ACTIVITY_REPORT_SECRET = 'test-report-password';
	const unauthorized = await send('Basic ' + Buffer.from('report:wrong').toString('base64'));
	expect(unauthorized.status).toBe(401);
	expect(unauthorized.headers.get('www-authenticate')).toContain('Basic');
	expect(fixture.report).not.toHaveBeenCalled();
	const response = await send('Basic ' + Buffer.from('report:test-report-password').toString('base64'));
	expect(response.status).toBe(200);
	expect(response.headers.get('cache-control')).toContain('no-store');
	expect(await response.text()).toContain('<strong>1</strong> potential cleanup candidates');
	expect(fixture.report).toHaveBeenCalledOnce();
});
