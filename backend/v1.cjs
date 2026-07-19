const { Client } = require('pg');
async function run() {
  const c = new Client('postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres');
  await c.connect();
  let r1 = await c.query("SELECT status, COUNT(*) FROM waiting_queue GROUP BY status ORDER BY count DESC;");
  console.log("V1-1:", r1.rows);
  let r2 = await c.query("SELECT status, COUNT(*) FROM visitor_sessions GROUP BY status ORDER BY count DESC;");
  console.log("V1-2:", r2.rows);
  try {
    let r3 = await c.query(`SELECT COUNT(*) AS orphaned_reservations FROM reservations r
      WHERE NOT EXISTS (
        SELECT 1 FROM visitor_sessions vs
        WHERE (vs.id = r.initiator_session_id OR vs.id = r.partner_session_id)
        AND vs.status = 'RESERVED'
      );`);
    console.log("V1-3:", r3.rows);
  } catch(e) { console.error("V1-3 error:", e.message); }
  await c.end();
}
run();
