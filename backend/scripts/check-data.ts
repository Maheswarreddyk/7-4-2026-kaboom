import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkData() {
  const { data: s, error } = await supabase.from('dashboard_summary').select('*');
  console.log('Dashboard Summary:', s);
  if (error) console.log('Error:', error);
}

checkData();
