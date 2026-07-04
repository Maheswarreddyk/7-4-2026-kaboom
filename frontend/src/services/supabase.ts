import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dirocenpssdilkztizps.supabase.co';
const supabaseKey = 'sb_publishable_rP4JPXaMpuyTLT75HEYCgg_3DXArD7Q';

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

