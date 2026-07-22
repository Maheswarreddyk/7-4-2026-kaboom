import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL || '',
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      {
        realtime: {
          params: { eventsPerSecond: 10 },
        },
      }
    );
  }
  return client;
}

