const { Client } = require('pg');
async function runDB(url, envName) {
  const client = new Client(url);
  await client.connect();
  console.log(`\n--- ${envName} Before ---`);
  let res1 = await client.query('SELECT status, COUNT(*) FROM waiting_queue GROUP BY status');
  console.log('Queue:', res1.rows);
  let res2 = await client.query(`
    SELECT COUNT(*) FROM reservations r 
    WHERE NOT EXISTS (
      SELECT 1 FROM visitor_sessions vs 
      WHERE vs.id = r.initiator_session_id AND vs.status = 'RESERVED'
    )
  `);
  console.log('Orphans:', res2.rows);

  console.log(`\n--- ${envName} Fix ---`);
  await client.query(`
    UPDATE waiting_queue 
    SET status = 'expired'
    WHERE status = 'matched'
    AND session_id NOT IN (
      SELECT initiator_session_id FROM reservations 
      UNION 
      SELECT partner_session_id FROM reservations
    )
  `);
  await client.query(`
    DELETE FROM reservations r
    WHERE NOT EXISTS (
      SELECT 1 FROM visitor_sessions vs 
      WHERE vs.id = r.initiator_session_id AND vs.status = 'RESERVED'
    )
  `);

  console.log(`\n--- ${envName} After ---`);
  let res3 = await client.query('SELECT status, COUNT(*) FROM waiting_queue GROUP BY status');
  console.log('Queue:', res3.rows);
  await client.end();
}
async function run() {
  await runDB('postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres', 'STAGING');
  await runDB('postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres', 'PRODUCTION');
}
run().catch(console.error);
