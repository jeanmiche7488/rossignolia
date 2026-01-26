// Re-export types and client functions only
// Server functions should be imported directly from './supabase-server'
export type { Database } from './supabase-types';
export { createBrowserClient } from './supabase-client';
