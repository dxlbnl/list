/**
 * Vitest setup for the client (browser/Svelte) test project.
 *
 * Wires `fake-indexeddb` so Dexie-backed client code (`src/lib/client/db.ts`,
 * `actions.ts`) has a working IndexedDB in the test environment, and stubs the
 * SvelteKit `$app`/`$env` virtual modules so client modules import cleanly.
 */
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true,
	dev: true,
	building: false,
	version: 'test'
}));

vi.mock('$env/static/public', () => ({
	PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
	PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
}));
