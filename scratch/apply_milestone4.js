const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:Mahes8019345028@db.khdchqwieoqljevdhpvc.supabase.co:5432/postgres' });
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/milestone4.sql', 'utf8');
  try {
    await client.query(sql);
    console.log('Milestone 4 migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
