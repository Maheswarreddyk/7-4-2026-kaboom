import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkRows() {
  const tables = [
    'analytics_sync_state',
    'dashboard_summary',
    'dashboard_hourly',
    'dashboard_daily',
    'dashboard_rankings',
    'dashboard_match_analytics',
    'dashboard_notifications',
    'dashboard_activity'
  ];

  console.log('--- Row Counts ---');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`[ERROR] ${table}: ${error.message}`);
    } else {
      console.log(`[OK] ${table}: ${count} rows`);
    }
  }
}

checkRows().catch(console.error);
