import { SignJWT, importPKCS8 } from 'jose';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

/**
 * Signs a Supabase-compatible JWT using ES256.
 * Requires an imported ECC private key and its corresponding Key ID (KID).
 */
export async function createSupabaseToken(userId: string) {
	try {
		const rawSecret = env.SUPABASE_JWT_SECRET;
		const kid = env.SUPABASE_JWT_KID;

		if (!rawSecret || !kid) {
			console.error('❌ SUPABASE_AUTH_ERROR: SUPABASE_JWT_SECRET or SUPABASE_JWT_KID is missing from .env');
			return '';
		}

		// Handle escaped newlines in .env
		const secret = rawSecret.replace(/\\n/g, '\n');

		if (!secret.includes('-----BEGIN')) {
			console.error('❌ SUPABASE_AUTH_ERROR: SUPABASE_JWT_SECRET is not a valid PEM (missing BEGIN header)');
			return '';
		}

		const privateKey = await importPKCS8(secret, 'ES256');

		return await new SignJWT({
			sub: userId,
			role: 'authenticated',
			iss: `${PUBLIC_SUPABASE_URL}/auth/v1`,
			aud: 'authenticated'
		})
			.setProtectedHeader({ 
				alg: 'ES256', 
				typ: 'JWT',
				kid: kid 
			})
			.setIssuedAt()
			.setExpirationTime('1h')
			.sign(privateKey);
	} catch (err) {
		console.error('CRITICAL: createSupabaseToken failed', err);
		return '';
	}
}
