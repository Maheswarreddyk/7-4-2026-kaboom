import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../supabase/.env.phase6test') });

const supabase = createClient(
  process.env.TEST_SUPABASE_URL || '',
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkSchema() {
  const { data, error } = await supabase.from('visitor_sessions').select('id').limit(1);
  if (error) {
    console.error('Schema check failed:', error);
  } else {
    console.log('Schema is present. Rows:', data);
  }
}
checkSchema();
