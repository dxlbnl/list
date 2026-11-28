import { render } from 'svelte/server';
import MagicLinkEmail from './templates/MagicLinkEmail.svelte';
import { resend } from './client';
import { env } from '$env/dynamic/private';
import { logger } from '$lib/logger';

const providerErrorNames = new Set([
	'invalid_idempotency_key', 'validation_error', 'missing_api_key', 'restricted_api_key',
	'invalid_api_key', 'not_found', 'method_not_allowed', 'invalid_idempotent_request',
	'concurrent_idempotent_requests', 'invalid_attachment', 'invalid_from_address', 'invalid_access',
	'invalid_parameter', 'invalid_region', 'missing_required_field', 'monthly_quota_exceeded',
	'daily_quota_exceeded', 'rate_limit_exceeded', 'security_error', 'application_error',
	'internal_server_error'
]);

const emailLogger = logger.child({ module: 'email' });

export async function sendMagicLink(
	email: string, url: string, type: 'secure' | 'login' = 'login', confidential = false
) {
	if (!env.RESEND_API_KEY) {
		emailLogger.warn('Email delivery unavailable because RESEND_API_KEY is not configured.');
		return { success: false };
	}

	const result = render(MagicLinkEmail, {
		props: {
			url,
			type
		}
	});

	const html = result.body;

	const subject = type === 'secure' ? 'Secure Your Lists Account' : 'Sign in to Lists';

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
			emailLogger.error('Resend error', {
				providerCode: providerErrorNames.has(error.name) ? error.name : 'unknown',
				providerStatus: typeof error.statusCode === 'number' ? error.statusCode : undefined
			});
			return { success: false, error };
		}

		emailLogger.info('Email sent successfully', confidential ? undefined : { to: email, messageId: data?.id });
		return { success: true, data };
	} catch (e) {
		emailLogger.error('Email sending exception', {
			errorKind: e instanceof TypeError ? 'transport_error' : 'unexpected_error'
		});
		return { success: false, error: e };
	}
}
