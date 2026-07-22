const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Mahes8019345028@db.khdchqwieoqljevdhpvc.supabase.co:5432/postgres' });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'realtime' AND table_name = 'messages';
  `);
  console.log('Columns in realtime.messages:', res.rows);
  await client.end();
}

run().catch(console.error);
