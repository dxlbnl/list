import { readLocalAccountSelector } from '$lib/account';
import { error } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { bindLocalAccount } from '$lib/client/db';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
	if (browser && data.user && !data.sessionInvalid) {
		if (readLocalAccountSelector(document.cookie) !== data.user.id) {
			error(409, 'The account changed. Reload to continue.');
		}
		await bindLocalAccount(data.user.id, data.previousAnonymousAccount);
	}
	return data;
};
