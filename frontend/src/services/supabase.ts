import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://dirocenpssdilkztizps.supabase.co';
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || 'sb_publishable_rP4JPXaMpuyTLT75HEYCgg_3DXArD7Q';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseKey);
  }

  return client;
}

