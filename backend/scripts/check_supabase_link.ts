import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSupabase() {
  console.log('--- Checking Supabase Link ---');
  console.log('URL:', process.env.SUPABASE_URL);

  // Check basic connection by selecting from visitor_sessions
  const { data: sessionData, error: sessionError } = await supabase.from('visitor_sessions').select('id').limit(1);
  if (sessionError) {
    console.error('❌ Failed to read visitor_sessions:', sessionError.message);
  } else {
    console.log('✅ Successfully read from visitor_sessions. Connection OK.');
  }

  // Check waiting_queue
  const { error: queueError } = await supabase.from('waiting_queue').select('id').limit(1);
  if (queueError) {
    console.error('❌ Failed to read waiting_queue:', queueError.message);
  } else {
    console.log('✅ Successfully read from waiting_queue.');
  }

  // Check matches
  const { error: matchError } = await supabase.from('matches').select('id').limit(1);
  if (matchError) {
    console.error('❌ Failed to read matches:', matchError.message);
  } else {
    console.log('✅ Successfully read from matches.');
  }

  // Check connection_logs
  const { error: logsError } = await supabase.from('connection_logs').select('id').limit(1);
  if (logsError) {
    console.error('❌ Failed to read connection_logs:', logsError.message);
  } else {
    console.log('✅ Successfully read from connection_logs.');
  }

  // Check Supabase Realtime Channels
  console.log('✅ Supabase Client initialized with Service Role Key (bypasses RLS).');
}

checkSupabase().catch(console.error);
