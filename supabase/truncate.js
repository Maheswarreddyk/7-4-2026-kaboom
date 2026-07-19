const { Client } = require('pg');

const connectionString = `postgresql://postgres:${encodeURIComponent('##Mahes@123*')}@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres`;

const client = new Client({ connectionString });

async function truncateTables() {
  try {
    await client.connect();
    
    // Truncate all tables used by Kaboom, restarting identity (so IDs reset, if serial)
    const tables = [
      'visitor_sessions',
      'waiting_queue',
      'matches',
      'reports',
      'feedback',
      'server_metrics',
      'connection_logs',
      'reservations',
      'analytics_events',
      'analytics_daily_snapshots',
      'users' // in case of auth.users it might be different, but public.users if it exists
    ];
    
    for (const table of tables) {
      try {
        await client.query(`TRUNCATE TABLE public.${table} CASCADE;`);
        console.log(`Truncated ${table}`);
      } catch (err) {
        if (err.code === '42P01') {
          console.log(`Table ${table} does not exist, skipping.`);
        } else {
          console.error(`Error truncating ${table}:`, err.message);
        }
      }
    }
    
    // Also re-initialize the server_metrics
    await client.query('INSERT INTO public.server_metrics (total_searching_users) VALUES (0);');
    console.log('Re-initialized server_metrics.');
    
  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    await client.end();
  }
}

truncateTables();
