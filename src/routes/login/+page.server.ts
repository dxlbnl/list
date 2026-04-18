import { db } from '$lib/server/db';
import { magicLinks } from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString();

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		// Generate token
		const token = crypto.randomUUID();
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

		// Log for dev (in production we'd use Resend/Postmark)
		console.log('--- MAGIC LINK ---');
		console.log(`To: ${email}`);
		console.log(`Link: ${confirmUrl}`);
		console.log('------------------');

		return { success: true };
	}
};
