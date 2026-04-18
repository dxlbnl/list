import { db } from '$lib/client/db';
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const ssr = false;

export const load: PageLoad = async ({ params, parent }) => {
	const { user } = await parent();
	
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const list = await db.lists
		.where('[createdBy+slug]')
		.equals([user.id, params.slug])
		.first();
	
	if (!list) {
		// Attempt to find by ID just in case (e.g. from a legacy link)
		const listById = await db.lists.get(params.slug);
		if (listById) {
			return {
				listId: listById.id,
				initialList: listById
			};
		}
		// throw error(404, 'List not found');
	}

	return {
		listId: list?.id,
		initialList: list
	};
};
