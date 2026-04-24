import { render } from 'svelte/server';
import MagicLinkEmail from './templates/MagicLinkEmail.svelte';
import { resend } from './client';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/logger';

const emailLogger = logger.child({ module: 'email' });

export async function sendMagicLink(email: string, url: string, type: 'secure' | 'login' = 'login') {
	const result = render(MagicLinkEmail, {
		props: {
			url,
			type
		}
	});

	const html = result.body;

	const subject = type === 'secure' ? 'Secure Your Lists Account' : 'Sign in to Lists';

	if (!env.RESEND_API_KEY) {
		emailLogger.warn('RESEND_API_KEY not set. Email will only be logged to console.');
		emailLogger.info('EMAIL SIMULATION', {
			to: email,
			subject,
			link: url
		});
		return { success: true, simulated: true };
	}

	try {
		const { data, error } = await resend.emails.send({
			from: 'Lists <noreply@lab.dxlb.nl>',
			to: [email],
			subject,
			html,
			headers: {
				'X-Entity-Ref-ID': crypto.randomUUID()
			}
		});

		if (error) {
			emailLogger.error('Resend error', { error, to: email });
			return { success: false, error };
		}

		emailLogger.info('Email sent successfully', { to: email, messageId: data?.id });
		return { success: true, data };
	} catch (e) {
		emailLogger.error('Email sending exception', { to: email }, e);
		return { success: false, error: e };
	}
}
