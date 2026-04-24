import { db } from './db';

/**
 * Clears local data and redirects to server logout
 */
export async function logout() {
	// Clear local database to prevent data leaking
	try {
		db.close();
		await db.delete();
	} catch (e) {
		console.error("Failed to purge local database:", e);
	}
	// Redirect to server-side logout
	window.location.href = "/logout";
}

/**
 * Fetches a one-time URL for cloning this session to another device
 */
export async function getCloneUrl() {
	const res = await fetch("/api/auth/clone", { method: "POST" });
	if (!res.ok) {
		throw new Error(`Failed to fetch clone URL: ${res.statusText}`);
	}
	const { url } = await res.json();
	return url;
}
