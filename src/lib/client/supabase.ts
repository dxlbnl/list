import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

/**
 * Shared Supabase client for real-time synchronization.
 * The client is initialized with the anon key, and we set the 
 * custom JWT (bridged auth) at runtime in the SyncManager.
 */
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
	realtime: {
		params: {
			eventsPerSecond: 10
		}
	}
});
