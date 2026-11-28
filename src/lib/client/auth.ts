import { accountFetch } from './account-fetch';
import { db } from './db';

let logoutPromise: Promise<void> | undefined;

/**
 * Revoke the server session before removing its local data.
 */
export function logout() {
	if (!logoutPromise) {
		logoutPromise = revokeAndClear().finally(() => {
			logoutPromise = undefined;
		});
	}
	return logoutPromise;
}

async function revokeAndClear() {
	try {
		const response = await fetch('/logout', {
			method: 'POST',
			headers: { Accept: 'application/json' },
			body: new URLSearchParams()
		});
		if (response.status !== 204) throw new Error(`Logout failed: HTTP ${response.status}`);
	} catch (error) {
		console.error('Failed to revoke the session:', error);
		window.alert('Could not sign out. Your local data was kept. Please try again.');
		return;
	}

	try {
		db.close();
		await db.delete();
	} catch (error) {
		console.error('Failed to purge local data:', error);
		window.alert('Your session ended, but local data could not be cleared. Please try signing out again.');
		return;
	}

	window.location.replace('/');
}

/**
 * Fetches a one-time URL for cloning this session to another device
 */
export async function getCloneUrl() {
	const res = await accountFetch("/api/auth/clone", { method: "POST" });
	if (!res.ok) {
		throw new Error(`Failed to fetch clone URL: ${res.statusText}`);
	}
	const { url } = await res.json();
	return url;
}
