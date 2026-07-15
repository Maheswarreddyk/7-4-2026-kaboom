import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const LOCK_ID = '00000000-0000-0000-0000-000000000000';

async function testLock() {
  const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

  const promise1 = supabase.from('visitor_sessions')
    .update({ status: 'locked', last_activity: new Date().toISOString() })
    .eq('id', LOCK_ID)
    .or(`status.eq.unlocked,last_activity.lt.${tenSecondsAgo}`)
    .select();
    
  const promise2 = supabase.from('visitor_sessions')
    .update({ status: 'locked', last_activity: new Date().toISOString() })
    .eq('id', LOCK_ID)
    .or(`status.eq.unlocked,last_activity.lt.${tenSecondsAgo}`)
    .select();

  const [res1, res2] = await Promise.all([promise1, promise2]);

  console.log('Update 1:', res1.data?.length);
  console.log('Update 2:', res2.data?.length);
}

testLock().catch(console.error);
