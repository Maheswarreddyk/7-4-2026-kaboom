const { Client } = require('pg');
async function run() {
  const pg = new Client({ connectionString: 'postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres' });
  await pg.connect();
  
  const res = await pg.query("SELECT routine_name FROM information_schema.routines WHERE routine_type='FUNCTION' AND specific_schema='public'");
  console.log('Public Functions:', res.rows.map(r => r.routine_name));
  
  await pg.end();
}
run().catch(console.error);
