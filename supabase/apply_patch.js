const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const urlEncodedPass = encodeURIComponent('##Mahes@123*');
const connectionString = `postgresql://postgres:${urlEncodedPass}@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres`;

const client = new Client({
  connectionString,
});

async function applySql() {
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, 'temp_patch.sql'), 'utf8');
    await client.query(sql);
    console.log('Successfully applied SQL patch');
  } catch (err) {
    console.error('Error applying SQL patch', err);
  } finally {
    await client.end();
  }
}

applySql();
