require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const sql = fs.readFileSync('../supabase/migrations/103_matchmaking_telemetry.sql', 'utf8');
  try {
    await client.query(sql);
    console.log('✅ Migration 103 applied successfully');
  } catch(e) {
    console.error('❌ Migration failed:', e.message);
    console.error('Detail:', e.detail);
    console.error('Hint:', e.hint);
  }
  await client.end();
}
main();
