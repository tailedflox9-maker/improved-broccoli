import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// REMOVED: supabaseServiceRoleKey - this was the security vulnerability
// REMOVED: supabaseAdmin client creation
// REMOVED: getAdminClient function

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key are required in .env.local');
}

// Only the regular client for normal user operations
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'ai-tutor-auth-token'
  }
});

// All admin operations now go through Edge Functions instead of a client-side admin client
