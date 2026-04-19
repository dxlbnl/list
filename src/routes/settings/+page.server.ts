import { db } from '$lib/server/db';
import { magicLinks } from '$lib/server/db/schema';
import { nanoid } from '$lib/utils';
import { fail, redirect } from '@sveltejs/kit';
import { sendMagicLink } from '$lib/server/email';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/');
	}

	return {
		user: locals.user
	};
};

export const actions: Actions = {
	secureAccount: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString();

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		if (!locals.user) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Generate token
		const token = nanoid();
		const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

		await db.insert(magicLinks).values({
			token,
			email,
			userIdToMerge: locals.user.id,
			expiresAt
		});

		// Build confirmation URL
		const confirmUrl = `${url.origin}/login/confirm/${token}`;

		// Send Email
		await sendMagicLink(email, confirmUrl, 'secure');

		return { success: true };
	}
};
