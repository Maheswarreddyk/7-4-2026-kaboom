const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres'
  });

  await client.connect();

  console.log('--- Query 1 ---');
  try {
    const q1 = await client.query('SELECT status, COUNT(*) FROM visitor_sessions GROUP BY status');
    console.log(JSON.stringify(q1.rows));
  } catch(e) { console.log('Err:', e.message); }

  console.log('--- Query 2 ---');
  try {
    const q2 = await client.query('SELECT status, COUNT(*) FROM waiting_queue GROUP BY status');
    console.log(JSON.stringify(q2.rows));
  } catch(e) { console.log('Err:', e.message); }

  console.log('--- Query 3 ---');
  try {
    const q3 = await client.query("SELECT COUNT(*) FROM reservations r LEFT JOIN visitor_sessions vs ON r.initiator_session_id = vs.id OR r.partner_session_id = vs.id WHERE vs.status != 'RESERVED'");
    console.log(JSON.stringify(q3.rows));
  } catch(e) { console.log('Err:', e.message); }

  console.log('--- Query 4 ---');
  try {
    const q4 = await client.query("SELECT COUNT(*) FROM waiting_queue WHERE status = 'matched' AND session_id NOT IN (SELECT initiator_session_id FROM reservations UNION SELECT partner_session_id FROM reservations)");
    console.log(JSON.stringify(q4.rows));
  } catch(e) { console.log('Err:', e.message); }

  await client.end();
}

run().catch(e => console.log('Global Err:', e.message));
