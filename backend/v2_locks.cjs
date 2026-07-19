const { Client } = require('pg');
async function run() {
  const c1 = new Client('postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres');
  await c1.connect();
  await c1.query('BEGIN');
  await c1.query('SELECT pg_try_advisory_xact_lock(8888)');
  
  const c2 = new Client('postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres');
  await c2.connect();
  let r = await c2.query(`
    SELECT locktype, classid, objid, mode, granted, pid
    FROM pg_locks
    WHERE locktype = 'advisory' AND objid = 8888
    ORDER BY granted DESC;
  `);
  console.log("V2-Locks:", r.rows);
  
  await c1.query('COMMIT');
  await c1.end();
  await c2.end();
}
run();
