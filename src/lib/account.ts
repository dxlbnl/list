export const ACCOUNT_HEADER = 'x-list-account';
export const ACCOUNT_CHANGED_HEADER = 'x-list-account-changed';

// Browser-only storage selector. Server API authorization still uses auth_session.
export const LOCAL_ACCOUNT_COOKIE = 'list_local_account';

export function accountDatabaseName(account: string) {
	return `ListAppDB:account:${account}`;
}

export function readLocalAccountSelector(cookieHeader: string) {
	const prefix = `${LOCAL_ACCOUNT_COOKIE}=`;
	const entry = cookieHeader.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith(prefix));
	if (!entry) return;
	try {
		return decodeURIComponent(entry.slice(prefix.length));
	} catch {
		return;
	}
}
