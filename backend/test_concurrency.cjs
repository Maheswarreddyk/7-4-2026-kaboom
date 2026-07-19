const { Client } = require('pg');
const url = 'postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres';

async function worker(id) {
  const client = new Client(url);
  await client.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('SELECT pg_try_advisory_xact_lock(8888) as acquired');
    const acquired = res.rows[0].acquired;
    console.log(`Worker ${id}: Lock acquired = ${acquired}`);
    
    // Simulate work if acquired
    if (acquired) {
      // While it's working, let's query pg_locks from THIS connection
      const locks = await client.query(`
        SELECT locktype, granted, pid 
        FROM pg_locks 
        WHERE locktype = 'advisory' AND granted = true
      `);
      console.log(`Worker ${id} sees granted advisory locks:`, locks.rows);
      await new Promise(r => setTimeout(r, 1000));
    }
    
    await client.query('COMMIT');
  } catch (e) {
    console.error(`Worker ${id} error:`, e);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

async function run() {
  console.log('Starting 10 concurrent workers...');
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(worker(i));
  }
  await Promise.all(promises);
}

run().catch(console.error);
