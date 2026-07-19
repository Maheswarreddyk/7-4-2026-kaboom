const { Client } = require('pg');
async function run() {
  const c = new Client('postgresql://postgres:%23%23Mahes%40123*@db.dirocenpssdilkztizps.supabase.co:5432/postgres');
  await c.connect();
  await c.query(`UPDATE visitor_sessions SET status = 'TERMINATED' WHERE status IN ('IDLE', 'ENDED', 'ended');`);
  
  let r = await c.query(`SELECT status, COUNT(*) FROM visitor_sessions 
    WHERE status NOT IN ('READY','SEARCHING','RESERVED','MATCHED','REQUEUEING','CONNECTED','TERMINATED')
    GROUP BY status;`);
  console.log("V7-Fix:", r.rows);
  await c.end();
}
run();
