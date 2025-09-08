import { createClient } from '@supabase/supabase-js';
import { Database } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key are required in .env.local');
}

// Regular client for normal user operations
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

// Admin client for admin operations (user creation, etc.)
// Only create this if service role key is available
export const supabaseAdmin = supabaseServiceRoleKey ? createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null;

// Helper to get the right client for admin operations
export const getAdminClient = () => {
  if (!supabaseAdmin) {
    throw new Error('Service role key not configured. Admin operations require VITE_SUPABASE_SERVICE_ROLE_KEY in environment variables.');
  }
  return supabaseAdmin;
};
