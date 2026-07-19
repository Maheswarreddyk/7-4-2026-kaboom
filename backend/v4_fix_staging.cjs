const { Client } = require('pg');
async function run() {
  const c = new Client('postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres');
  await c.connect();
  let r = await c.query(`
    SELECT city, COUNT(*) FROM visitor_sessions 
    WHERE city IS NOT NULL 
    GROUP BY city 
    HAVING city != LOWER(TRIM(city))
    ORDER BY count DESC
    LIMIT 20;
  `);
  console.log("V4-Staging:", r.rows);
  
  if (r.rows.length > 0) {
    await c.query(`UPDATE visitor_sessions SET city = LOWER(TRIM(city)) WHERE city IS NOT NULL;`);
    await c.query(`UPDATE visitor_sessions SET country = LOWER(TRIM(country)) WHERE country IS NOT NULL;`);
    await c.query(`UPDATE visitor_sessions SET state = LOWER(TRIM(state)) WHERE state IS NOT NULL;`);
    await c.query(`UPDATE visitor_sessions SET district = LOWER(TRIM(district)) WHERE district IS NOT NULL;`);
  }
  
  await c.end();
}
run();
