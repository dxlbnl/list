import { render } from 'svelte/server';
import MagicLinkEmail from './templates/MagicLinkEmail.svelte';
import { resend } from './client';
import { env } from '$env/dynamic/private';

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
		console.warn('RESEND_API_KEY not set. Email will only be logged to console.');
		console.log('--- EMAIL SIMULATION ---');
		console.log(`To: ${email}`);
		console.log(`Subject: ${subject}`);
		console.log(`Link: ${url}`);
		console.log('-----------------------');
		return { success: true, simulated: true };
	}

	try {
		const { data, error } = await resend.emails.send({
			from: 'Lists <noreply@lab.dxlb.nl>',
			to: [email],
			subject,
			html
		});

		if (error) {
			console.error('Resend error:', error);
			return { success: false, error };
		}

		return { success: true, data };
	} catch (e) {
		console.error('Email sending exception:', e);
		return { success: false, error: e };
	}
}
