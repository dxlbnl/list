import { afterEach, expect, it, vi } from 'vitest';
import { db } from './db';
import { logout } from './auth';

vi.mock('./db', () => ({ db: { close: vi.fn(), delete: vi.fn() } }));

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

it('keeps local data and stays on the page if the revocation request fails', async () => {
	const request = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
	const alert = vi.fn();
	const replace = vi.fn();
	vi.stubGlobal('fetch', request);
	vi.stubGlobal('window', { alert, location: { replace } });
	const report = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		await logout();
		expect(db.close).not.toHaveBeenCalled();
		expect(db.delete).not.toHaveBeenCalled();
		expect(replace).not.toHaveBeenCalled();
		expect(alert).toHaveBeenCalledOnce();
	} finally {
		report.mockRestore();
	}
});

it('clears the local database after one successful revocation before navigating', async () => {
	const order: string[] = [];
	const request = vi.fn(async () => {
		order.push('revoke');
		return new Response(null, { status: 204 });
	});
	const alert = vi.fn();
	const replace = vi.fn(() => { order.push('redirect'); });
	vi.stubGlobal('fetch', request);
	vi.stubGlobal('window', { alert, location: { replace } });
	vi.mocked(db.delete).mockImplementation(async () => { order.push('cleanup'); });

	await Promise.all([logout(), logout()]);

	expect(request).toHaveBeenCalledOnce();
	expect(request).toHaveBeenCalledWith('/logout', expect.objectContaining({ method: 'POST' }));
	expect(order).toEqual(['revoke', 'cleanup', 'redirect']);
	expect(replace).toHaveBeenCalledWith('/');
	expect(alert).not.toHaveBeenCalled();
});
