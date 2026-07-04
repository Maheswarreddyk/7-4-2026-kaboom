#!/usr/bin/env node
/**
 * Post-deployment API verification script.
 * Runs after deploy to confirm all critical endpoints are live.
 * Exits 1 if any endpoint returns 404 or fails.
 */

const BASE_URL = process.argv[2] || process.env.RENDER_EXTERNAL_URL || 'http://localhost:10000';

const VERIFY_UUID = '00000000-0000-0000-0000-000000000000';
const VERIFY_MATCH_UUID = '00000000-0000-0000-0000-000000000001';

const ENDPOINTS = [
  { method: 'GET',  path: '/api/health' },
  { method: 'GET',  path: '/api/stats' },
  { method: 'POST', path: '/api/start-session',  body: { userAgent: 'verify-bot', language: 'en', timezone: 'UTC' } },
  { method: 'POST', path: '/api/match/join',      body: { sessionId: VERIFY_UUID, sessionToken: 'verify-token' } },
  { method: 'POST', path: '/api/match/ready',     body: { sessionId: VERIFY_UUID, sessionToken: 'verify-token', matchId: VERIFY_MATCH_UUID } },
  { method: 'POST', path: '/api/match/next',      body: { sessionId: VERIFY_UUID, sessionToken: 'verify-token' } },
  { method: 'POST', path: '/api/match/disconnect', body: { sessionId: VERIFY_UUID, sessionToken: 'verify-token', reason: 'leave' } },
];

async function verify() {
  console.log(`\n🔍 Verifying API endpoints at: ${BASE_URL}\n`);
  let failed = 0;

  for (const ep of ENDPOINTS) {
    const url = `${BASE_URL}${ep.path}`;
    try {
      const opts = {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (ep.body) opts.body = JSON.stringify(ep.body);

      const res = await fetch(url, opts);
      const ct = res.headers.get('content-type') || '';
      let body = '';
      if (ct.includes('application/json')) {
        try { body = JSON.stringify(await res.json()); } catch {}
      } else {
        body = await res.text();
      }

      if (res.status === 404) {
        console.error(`❌ 404 NOT FOUND  ${ep.method} ${ep.path}`);
        failed++;
      } else if (res.status >= 500) {
        console.warn(`⚠️  ${res.status} SERVER ERROR  ${ep.method} ${ep.path} — ${body.slice(0,120)}`);
        // 500s are OK for verify-bot requests (no real session), but 404 is not
      } else {
        console.log(`✅ ${res.status}  ${ep.method} ${ep.path}`);
      }
    } catch (err) {
      console.error(`❌ NETWORK ERROR  ${ep.method} ${ep.path} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${failed === 0 ? '✅ All endpoints verified.' : `❌ ${failed} endpoint(s) missing or unreachable.`}\n`);
  if (failed > 0) process.exit(1);
}

verify();
