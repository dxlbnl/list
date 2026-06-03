/**
 * Vitest setup for the node (server) test project.
 *
 * Provides default values for `$env/*` so server modules that read environment
 * variables (e.g. `src/lib/server/db/index.ts`, `supabase-auth.ts`) import
 * cleanly under test without a real `.env`. Real tests can override these.
 */
import { vi } from 'vitest';

// `$env/dynamic/private` reads from process.env at runtime.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.RESEND_API_KEY ??= 'test-resend-key';
process.env.SUPABASE_JWT_SECRET ??= 'test-jwt-secret';
process.env.SUPABASE_JWT_KID ??= 'test-kid';

// `$env/static/public` is inlined at build time; stub it so client/server
// modules that import public env vars resolve under test.
vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
	PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
}));

// `$app/environment` is a SvelteKit ambient module; provide test defaults.
vi.mock('$app/environment', () => ({
	browser: false,
	dev: true,
	building: false,
	version: 'test'
}));
