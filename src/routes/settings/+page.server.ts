import { db } from '$lib/server/db';
import { magicLinks } from '$lib/server/db/schema';
import { nanoid } from '$lib/utils';
import { fail, redirect } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import { sendMagicLink } from '$lib/server/email';
import { checkRateLimit } from '$lib/server/ratelimit';
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
	secureAccount: async ({ request, locals, url, getClientAddress }) => {
		// Rate limit: 3 emails per 10 minutes per IP
		const ip = getClientAddress();
		const allowed = await checkRateLimit(`secure-email:${ip}`, 3, 10);
		if (!allowed) {
			return fail(429, { error: MESSAGES.AUTH.RATE_LIMIT });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString();

		if (!email) {
			return fail(400, { error: MESSAGES.AUTH.EMAIL_REQUIRED });
		}

		if (!locals.user) {
			return fail(401, { error: MESSAGES.AUTH.NOT_AUTHENTICATED });
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
