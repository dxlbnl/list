import { db } from '$lib/server/db';
import { lists, listUsers, listInvites } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import { nanoid } from '$lib/utils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { token } = params;
	const user = locals.user;

	if (!user) throw error(401, 'Unauthorized');

	// 1. Validate Invite
	const invite = await db.query.listInvites.findFirst({
		where: eq(listInvites.token, token)
	});

	if (!invite) {
		throw error(404, 'Invite link not found or expired');
	}

	if (invite.expiresAt && invite.expiresAt < new Date()) {
		await db.delete(listInvites).where(eq(listInvites.token, token));
		throw error(410, 'Invite link has expired');
	}

	// 2. Grant Access
	await db
		.insert(listUsers)
		.values({
			listId: invite.listId,
			userId: user.id
		})
		.onConflictDoNothing();

	// 3. Get list details to determine redirect
	const list = await db.query.lists.findFirst({
		where: eq(lists.id, invite.listId)
	});

	if (!list) throw error(404, 'List not found');

	// 4. Check for slug collision for THIS user
	// A collision occurs if the user ALREADY has a list with this slug that they CREATED.
	const myOwnListWithSameSlug = await db.query.lists.findFirst({
		where: and(eq(lists.slug, list.slug), eq(lists.createdBy, user.id))
	});

	let redirectSlug = list.slug;
	if (myOwnListWithSameSlug && myOwnListWithSameSlug.id !== list.id) {
		// Collision! Redirect to disambiguated slug
		redirectSlug = `${list.slug}--${nanoid(4)}`;
	}

	throw redirect(303, `/${redirectSlug}`);
};
