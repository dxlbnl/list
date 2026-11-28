import { browser } from '$app/environment';
import { bindLocalAccount } from '$lib/client/db';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ data }) => {
	if (browser && data.user && !data.sessionInvalid) await bindLocalAccount(data.user.id, data.previousAnonymousAccount);
	return data;
};
