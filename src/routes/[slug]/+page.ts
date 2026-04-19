import { db } from '$lib/client/db';
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { syncManager } from '$lib/client/sync.svelte';

export const ssr = false;

async function findList(slug: string, userId: string) {
	// 1. Try exact match: User's own list with this slug
	let list = await db.lists
		.where('[createdBy+slug]')
		.equals([userId, slug])
		.first();
	
	// 2. Try any list with this slug that the user has access to
	if (!list) {
		list = await db.lists.where('slug').equals(slug).first();
	}

	// 3. Try disambiguated slug: [baseSlug]--[ownerPrefix]
	if (!list && slug.includes('--')) {
		const doubleDashIdx = slug.lastIndexOf('--');
		const baseSlug = slug.slice(0, doubleDashIdx);
		const prefix = slug.slice(doubleDashIdx + 2);
		if (baseSlug && prefix) {
			const candidates = await db.lists.where('slug').equals(baseSlug).toArray();
			list = candidates.find(l => l.createdBy.startsWith(prefix));
		}
	}

	// 4. Try by ID
	if (!list) {
		list = await db.lists.get(slug) ?? undefined;
	}

	return list;
}

export const load: PageLoad = async ({ params, parent }) => {
	const { user } = await parent();
	
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	let list = await findList(params.slug, user.id);
	
	// If not found locally, sync from server and retry
	// This handles the case where a user just joined via an invite link
	if (!list) {
		await syncManager.reconcileAllLists();
		list = await findList(params.slug, user.id);
	}

	if (!list) {
		throw error(404, 'List not found');
	}

	return {
		listId: list.id,
		initialList: list,
		title: list.name
	};
};
