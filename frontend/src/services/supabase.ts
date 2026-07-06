import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'config';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(environment.supabase.url, environment.supabase.anonKey, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });
  }
  return client;
}
