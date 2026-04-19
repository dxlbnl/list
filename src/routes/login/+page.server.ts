import { db } from '$lib/server/db';
import { users, magicLinks } from '$lib/server/db/schema';
import { nanoid } from '$lib/utils';
import { eq, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { sendMagicLink } from '$lib/server/email';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString();

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		// Check if user exists and is verified
		const existingUser = await db
			.select()
			.from(users)
			.where(and(eq(users.email, email), eq(users.email_verified, true)));

		if (existingUser.length === 0) {
			return fail(400, { error: 'No verified account found with this email. Please use "Secure Account" first.' });
		}

		// Generate token
		const token = nanoid();
		const expiresAt = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

		// The current user (anonymous session) that will be merged into the email account
		const userIdToMerge = locals.user?.id;

		await db.insert(magicLinks).values({
			token,
			email,
			userIdToMerge,
			expiresAt
		});

		// Build confirmation URL
		const confirmUrl = `${url.origin}/login/confirm/${token}`;

		// Send Email
		await sendMagicLink(email, confirmUrl, 'login');

		return { success: true };
	}
};
