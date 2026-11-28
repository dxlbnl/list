import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createAnonymousSession, getSession } from './auth';
import { sendMagicLink } from './email';

const fixture = vi.hoisted(() => ({
	env: { RESEND_API_KEY: undefined as string | undefined },
	log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
	send: vi.fn()
}));

vi.mock('$lib/logger', () => ({ logger: { ...fixture.log, child: () => fixture.log } }));
vi.mock('$env/dynamic/private', () => ({ env: fixture.env }));
vi.mock('./email/client', () => ({ resend: { emails: { send: fixture.send } } }));
vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ innerJoin: () => ({ where: async () => [] }) }) }),
		insert: () => ({ values: async () => {} })
	}
}));

beforeEach(() => {
	vi.clearAllMocks();
	fixture.env.RESEND_API_KEY = undefined;
});

it('omits missing and newly created session IDs from authentication logs', async () => {
	const missingId = 'fixture-missing-session';
	const cookies = { get: () => missingId, set: vi.fn() };
	const event = { cookies } as unknown as RequestEvent;
	expect(await getSession(event)).toBeNull();
	expect(fixture.log.warn).toHaveBeenCalled();
	const { session, user } = await createAnonymousSession(event);
	expect(cookies.set).toHaveBeenCalledWith('auth_session', session.id, expect.anything());
	expect(fixture.log.info).toHaveBeenCalledWith('Created anonymous session', { userId: user.id });
	const logs = JSON.stringify([fixture.log.warn.mock.calls, fixture.log.info.mock.calls]);
	expect(logs).not.toContain(missingId);
	expect(logs).not.toContain(session.id);
});

it('reports unavailable email without logging a magic link', async () => {
	const token = 'fixture-magic-token';
	const url = `https://list.example.test/login/confirm/${token}`;
	expect(await sendMagicLink('person@example.test', url)).toEqual({ success: false });
	expect(fixture.send).not.toHaveBeenCalled();
	expect(fixture.log.warn).toHaveBeenCalled();
	expect(JSON.stringify([fixture.log.warn.mock.calls, fixture.log.info.mock.calls])).not.toContain(token);
});

it('retains provider codes and status without logging credential-bearing messages', async () => {
	fixture.env.RESEND_API_KEY = 'fixture-resend-key';
	const token = 'fixture-magic-token';
	const url = `https://list.example.test/login/confirm/${token}`;
	fixture.send.mockResolvedValueOnce({ error: { message: url, name: 'rate_limit_exceeded', statusCode: 429 } });
	expect(await sendMagicLink('person@example.test', url)).toMatchObject({ success: false });
	fixture.send.mockRejectedValueOnce(new TypeError(url));
	expect(await sendMagicLink('person@example.test', url)).toMatchObject({ success: false });
	expect(fixture.log.error).toHaveBeenCalledTimes(2);
	expect(fixture.log.error).toHaveBeenNthCalledWith(1, 'Resend error', {
		providerCode: 'rate_limit_exceeded', providerStatus: 429
	});
	expect(fixture.log.error).toHaveBeenNthCalledWith(2, 'Email sending exception', { errorKind: 'transport_error' });
	expect(JSON.stringify(fixture.log.error.mock.calls)).not.toContain(token);
});
