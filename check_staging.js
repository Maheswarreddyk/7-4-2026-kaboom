const { Client } = require('pg');
async function run() {
  const pg = new Client({ connectionString: 'postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres' });
  await pg.connect();
  const res2 = await pg.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Staging Public Tables:', res2.rows.map(r => r.table_name));
  await pg.end();
}
run().catch(console.error);
