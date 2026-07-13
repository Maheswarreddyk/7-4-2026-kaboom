import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkRemoteDatabase() {
  console.log('--- Checking Remote Supabase Instance ---');

  const tables = [
    'analytics_events',
    'analytics_daily_snapshots',
    'connection_logs',
    'feedback',
    'interests',
    'likes',
    'locations',
    'matches',
    'push_subscriptions',
    'reports',
    'reservations',
    'server_metrics',
    'temporary_messages',
    'user_preferences_cache',
    'visitor_sessions',
    'waiting_queue'
  ];

  const rpcs = [
    'advisory_unlock',
    'get_campus_leaderboard',
    'get_funnel_metrics',
    'get_match_quality',
    'get_search_demand',
    'try_advisory_lock'
  ];

  console.log('\n[Tables]');
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log(`[MISSING TABLE] ${table}`);
    } else {
      console.log(`[OK] Table ${table}`);
    }
  }

  console.log('\n[RPCs]');
  for (const rpc of rpcs) {
    let args = {};
    if (rpc === 'try_advisory_lock' || rpc === 'advisory_unlock') {
      args = { lock_id: 1 };
    } else {
      args = { interval_hours: 24 };
    }

    const { error } = await supabase.rpc(rpc, args);
    if (error && error.message && error.message.includes('Could not find')) {
      console.log(`[MISSING RPC] ${rpc} - ${error.message}`);
    } else if (error) {
      console.log(`[ERROR / OK] RPC ${rpc} exists but failed: ${error.message}`);
    } else {
      console.log(`[OK] RPC ${rpc}`);
    }
  }

  // Specifically check for idempotency_key
  const { error: colErr } = await supabase.from('analytics_events').select('idempotency_key').limit(1);
  if (colErr && colErr.code === '42703') {
    console.log(`[MISSING COLUMN] idempotency_key in analytics_events`);
  } else {
    console.log(`[OK] Column idempotency_key in analytics_events`);
  }
}

checkRemoteDatabase().catch(console.error);
