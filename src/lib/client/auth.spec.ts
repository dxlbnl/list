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
	const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
	const alert = vi.fn();
	const replace = vi.fn();
	vi.stubGlobal('fetch', request);
	vi.stubGlobal('window', { alert, location: { replace } });

	await Promise.all([logout(), logout()]);

	expect(request).toHaveBeenCalledOnce();
	expect(request).toHaveBeenCalledWith('/logout', expect.objectContaining({ method: 'POST' }));
	const cleanupOrder = vi.mocked(db.delete).mock.invocationCallOrder[0];
	expect(cleanupOrder).toBeGreaterThan(request.mock.invocationCallOrder[0]);
	expect(cleanupOrder).toBeLessThan(replace.mock.invocationCallOrder[0]);
	expect(replace).toHaveBeenCalledWith('/');
	expect(alert).not.toHaveBeenCalled();
});
