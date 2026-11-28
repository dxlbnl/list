import { db } from '$lib/server/db';
import { users, magicLinks } from '$lib/server/db/schema';
import { nanoid } from '$lib/utils';
import { eq, and } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import { sendMagicLink } from '$lib/server/email';
import { checkRateLimit } from '$lib/server/ratelimit';
import { oauthCookie, stageOAuthLogin } from '$lib/server/oauth';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url, getClientAddress, cookies }) => {
		// Rate limit: 3 emails per 10 minutes per IP
		const ip = getClientAddress();
		const allowed = await checkRateLimit(`login-email:${ip}`, 3, 10);
		if (!allowed) {
			return fail(429, { error: MESSAGES.AUTH.RATE_LIMIT });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString();

		if (!email) {
			return fail(400, { error: MESSAGES.AUTH.EMAIL_REQUIRED });
		}

		// Check if user exists and is verified
		const existingUser = await db
			.select()
			.from(users)
			.where(and(eq(users.email, email), eq(users.email_verified, true)));

		if (existingUser.length === 0) {
			// Prevent account enumeration: return success even if email doesn't exist
			return { success: true };
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

		const oauthTicket = cookies.get(oauthCookie);
		const oauthLogin = !!oauthTicket && url.searchParams.get('oauth') === '1';
		if (oauthLogin) await stageOAuthLogin(db, oauthTicket, token);

		// Build confirmation URL
		const confirmUrl = `${url.origin}/login/confirm/${token}`;

		// Send Email
		await sendMagicLink(email, confirmUrl, 'login', oauthLogin);

		return { success: true };
	}
};
