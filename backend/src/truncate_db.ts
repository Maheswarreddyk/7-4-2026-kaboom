import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'C:\\Users\\coding\\Desktop\\indiaTV\\.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or Service Role Key in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function truncateDB() {
  console.log("Truncating match_audit_logs...");
  await supabase.from('match_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Truncating connections...");
  await supabase.from('connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Truncating messages...");
  await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Truncating matches...");
  await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Truncating queue...");
  await supabase.from('queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("Truncating sessions...");
  await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log("All tables cleared.");
}

truncateDB().catch(console.error);
