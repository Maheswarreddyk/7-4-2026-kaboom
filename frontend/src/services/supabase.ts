import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Hardcoded credentials — safe for frontend (anon/publishable key only)
const SUPABASE_URL = 'https://dirocenpssdilkztizps.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpcm9jZW5wc3NkaWxrenRpenBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTY1MzUsImV4cCI6MjA5ODMzMjUzNX0.P1NX8cfS4rTafIINUONBrWH3wI4DaUYrQJJUCJXvU9Y';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return client;
}
