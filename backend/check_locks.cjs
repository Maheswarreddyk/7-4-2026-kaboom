const { Client } = require('pg');
async function checkLocks() {
  const connectionString = 'postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres';
  const pg = new Client({ connectionString });
  
  await pg.connect();
  
  const locks = await pg.query("SELECT locktype, mode, granted, pid FROM pg_locks WHERE NOT granted;");
  console.log('--- Locks NOT granted ---');
  console.log(locks.rows);
  
  const activity = await pg.query("SELECT pid, wait_event_type, wait_event, state, query FROM pg_stat_activity WHERE state != 'idle';");
  console.log('--- Active queries ---');
  console.log(activity.rows);
  
  await pg.end();
}

checkLocks().catch(console.error);
