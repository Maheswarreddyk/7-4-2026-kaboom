const { Client } = require('pg');
async function r(){ 
  const c = new Client('postgresql://postgres:%23%23Mahes%40123*@db.ripfrcboxqjuexvyfocx.supabase.co:5432/postgres'); 
  await c.connect(); 
  const res = await c.query("SELECT id, session_id, status FROM waiting_queue WHERE session_id = '5183c141-9af5-44c9-ba8d-00d25f3c6678'"); 
  console.log(res.rows); 
  const idx = await c.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'waiting_queue'");
  console.log(idx.rows);
  await c.end(); 
} 
r();
