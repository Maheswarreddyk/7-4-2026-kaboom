require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  return client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'matchmaking_decisions' ORDER BY ordinal_position");
}).then(res => {
  console.log('matchmaking_decisions columns:');
  res.rows.forEach(r => console.log(' -', r.column_name));
}).finally(() => client.end());
