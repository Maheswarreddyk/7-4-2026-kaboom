import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  const { error } = await supabase.from('analytics_sync_state').select('*').limit(1);
  if (error && error.code === '42P01') {
    console.log('MISSING');
  } else {
    console.log('EXISTS');
  }
}

check().catch(console.error);
