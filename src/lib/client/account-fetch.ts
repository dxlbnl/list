import { ACCOUNT_CHANGED_HEADER, ACCOUNT_HEADER } from '$lib/account';
import { getLocalAccount } from './db';

/** Guard browser API requests against a cookie change in another document. */
export async function accountFetch(input: RequestInfo | URL, init?: RequestInit) {
	const account = getLocalAccount();
	const headers = new Headers(init?.headers);
	if (account) headers.set(ACCOUNT_HEADER, account);

	const response = await fetch(input, { ...init, headers, cache: 'no-store' });
	if (account && response.headers.has(ACCOUNT_CHANGED_HEADER)) {
		window.location.reload();
		throw new Error('The active account changed.');
	}
	return response;
}
