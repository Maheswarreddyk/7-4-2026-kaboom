const { Client } = require('pg');
async function run() {
  const pg = new Client({ connectionString: 'postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres' });
  await pg.connect();
  
  const res = await pg.query("SELECT pg_get_functiondef('matchmaker_create_reservation'::regproc)");
  console.log(res.rows[0].pg_get_functiondef);
  
  await pg.end();
}
run().catch(console.error);
