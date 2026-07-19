const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT locktype, relation, mode, granted, pid FROM pg_locks WHERE locktype = 'advisory';");
  console.log('Result:');
  console.table(res.rows);
  await client.end();
}

run().catch(console.error);
