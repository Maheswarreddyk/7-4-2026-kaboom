const { Client } = require('pg');
async function run() {
  const pg = new Client({ connectionString: 'postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres' });
  await pg.connect();
  
  const res = await pg.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'reservations'");
  console.log(res.rows);
  
  await pg.end();
}
run().catch(console.error);
