/**
 * IndiaTV Matchmaking Engine Tests
 * Run: node scripts/matchmaking-test.mjs
 */
const API_URL = process.env.API_URL || 'http://localhost:5000/api';

const results = [];

function pass(name, detail = '') {
  results.push({ name, status: 'PASS', detail });
  console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, status: 'FAIL', detail });
  console.error(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function startSession(label) {
  const res = await fetch(`${API_URL}/start-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ browser: label }),
  });
  const data = await res.json();
  return data.data;
}

async function joinQueue(sessionId, sessionToken) {
  const res = await fetch(`${API_URL}/match/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sessionToken }),
  });
  const data = await res.json();
  return data;
}

async function testQueueIdempotency() {
  const session = await startSession('QueueTest');
  if (!session) {
    fail('Queue idempotency setup', 'No session');
    return;
  }

  const first = await joinQueue(session.sessionId, session.sessionToken);
  if (first.data?.status !== 'waiting') {
    fail('Queue idempotency', `Expected waiting, got ${first.data?.status}`);
    return;
  }

  await new Promise((r) => setTimeout(r, 1500));

  const second = await joinQueue(session.sessionId, session.sessionToken);
  if (second.data?.status !== 'waiting') {
    fail('Queue idempotency', `Second join status=${second.data?.status}`);
    return;
  }

  pass('Queue idempotency', 'Repeated joinQueue returns waiting without error');
}

async function testTwoUserMatch() {
  const userA = await startSession('MatchA');
  const userB = await startSession('MatchB');

  if (!userA || !userB) {
    fail('Two-user match setup', 'Failed to create sessions');
    return;
  }

  await joinQueue(userA.sessionId, userA.sessionToken);
  await new Promise((r) => setTimeout(r, 300));
  const joinB = await joinQueue(userB.sessionId, userB.sessionToken);

  let matchId = joinB.data?.matchId || null;
  let partnerForA = null;
  let partnerForB = null;

  for (let i = 0; i < 15; i++) {
    const pollA = await joinQueue(userA.sessionId, userA.sessionToken);
    const pollB = await joinQueue(userB.sessionId, userB.sessionToken);

    if (pollA.data?.status === 'matched') {
      partnerForA = pollA.data.partnerSessionId;
      matchId = pollA.data.matchId;
    }
    if (pollB.data?.status === 'matched') {
      partnerForB = pollB.data.partnerSessionId;
      matchId = pollB.data.matchId;
    }

    if (
      partnerForA === userB.sessionId &&
      partnerForB === userA.sessionId &&
      matchId
    ) {
      pass('Two-user match', `matchId=${matchId.slice(0, 8)}...`);
      return;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  fail(
    'Two-user match',
    `A partner=${partnerForA?.slice(0, 8) ?? 'none'}, B partner=${partnerForB?.slice(0, 8) ?? 'none'}`
  );
}

async function testReadyEndpoint() {
  const userA = await startSession('ReadyA');
  const userB = await startSession('ReadyB');
  if (!userA || !userB) {
    fail('READY endpoint setup', 'No sessions');
    return;
  }

  await joinQueue(userA.sessionId, userA.sessionToken);
  await new Promise((r) => setTimeout(r, 300));
  const joinB = await joinQueue(userB.sessionId, userB.sessionToken);

  let matchId = joinB.data?.matchId;
  if (!matchId) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const poll = await joinQueue(userA.sessionId, userA.sessionToken);
      if (poll.data?.matchId) {
        matchId = poll.data.matchId;
        break;
      }
    }
  }

  if (!matchId) {
    fail('READY endpoint', 'No match created');
    return;
  }

  const readyRes = await fetch(`${API_URL}/match/ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: userA.sessionId,
      sessionToken: userA.sessionToken,
      matchId,
    }),
  });

  if (!readyRes.ok) {
    fail('READY endpoint', await readyRes.text());
    return;
  }

  pass('READY endpoint', `matchId=${matchId.slice(0, 8)}...`);
}

async function run() {
  console.log('\n========================================');
  console.log('  IndiaTV Matchmaking Test Suite');
  console.log('========================================\n');

  try {
    const health = await fetch(`${API_URL}/health`).then((r) => r.json());
    if (health.status !== 'healthy') {
      fail('Health check', JSON.stringify(health));
      process.exit(1);
    }
    pass('Health check', `database=${health.database}`);
  } catch (err) {
    fail('Health check', err.message);
    console.error('\nStart backend: npm run build && npm start\n');
    process.exit(1);
  }

  await testTwoUserMatch();
  await testQueueIdempotency();
  await testReadyEndpoint();

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
