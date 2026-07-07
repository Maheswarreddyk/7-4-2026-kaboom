import { getSupabase, handleSupabaseError } from '../database/client.js';
import { getIceServers } from '../config/index.js';
import { broadcastToSession } from './broadcast.js';
import { leaveQueueEntry, joinQueueEntry, markUserReady, runMatchCycle, runGlobalMatchCycle } from '../matchmaking/matchingEngine.js';

export type MatchEndReason = 'next' | 'leave' | 'disconnect' | 'report';

// ============================================================
// Global Cycle Mutex
// Prevents concurrent runGlobalMatchCycle() execution from:
//   - REST /match/join endpoint
//   - MatchScheduler background loop
// This is instance-local (single Render instance). Acceptable for now.
// Phase 3 TODO: move to DB-level advisory lock for multi-instance scaling.
// ============================================================
let globalCycleRunning = false;

export async function safeRunGlobalMatchCycle(): Promise<void> {
  if (globalCycleRunning) {
    console.log('[MatchService] Global cycle already running — skipping concurrent trigger');
    return;
  }
  globalCycleRunning = true;
  try {
    await runGlobalMatchCycle(getSupabase());
  } finally {
    globalCycleRunning = false;
  }
}

export async function validateSession(sessionId: string, sessionToken?: string) {
  const { data, error } = await getSupabase()
    .from('visitor_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'Failed to validate session');
  if (!data) return null;
  if (sessionToken && data.session_token !== sessionToken) return null;
  if (data.status === 'ended') return null;
  return data;
}

async function findActiveMatch(sessionId: string) {
  const { data, error } = await getSupabase()
    .from('matches')
    .select('*')
    .is('ended_at', null)
    .or(`user_a.eq.${sessionId},user_b.eq.${sessionId}`)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) handleSupabaseError(error, 'Failed to find active match');
  return data;
}

export async function endActiveMatch(sessionId: string, reason: MatchEndReason) {
  const match = await findActiveMatch(sessionId);
  if (!match) return null;

  const startedAt = new Date(match.started_at).getTime();
  const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;

  const { error } = await getSupabase()
    .from('matches')
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      ended_reason: reason,
    })
    .eq('id', match.id);

  if (error) handleSupabaseError(error, 'Failed to end match');

  await getSupabase()
    .from('connection_logs')
    .insert({
      session_id: sessionId,
      event: 'match_end',
      details: { matchId: match.id, reason },
    });

  return { match, partnerId };
}

export async function joinQueue(sessionId: string, sessionToken: string) {
  return runMatchCycle(getSupabase(), sessionId, sessionToken);
}

export async function markMatchReady(sessionId: string, sessionToken: string, matchId: string) {
  return markUserReady(getSupabase(), sessionId, sessionToken, matchId);
}

export async function leaveQueue(sessionId: string, sessionToken: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');
  await leaveQueueEntry(getSupabase(), sessionId);
}

/**
 * Re-queue a partner after their previous partner left.
 * Phase 2 fix: Uses joinQueueEntry + safeRunGlobalMatchCycle directly instead of
 * calling joinQueue() (which calls runMatchCycle which re-runs runGlobalMatchCycle recursively).
 * The global cycle mutex prevents scheduling conflicts.
 */
async function requeuePartner(partnerId: string): Promise<void> {
  const partner = await validateSession(partnerId);
  if (!partner) {
    console.log(`[MatchService] requeuePartner: session ${partnerId} not found or ended`);
    return;
  }

  // Notify partner they are being re-matched
  await broadcastToSession(partnerId, 'searching', {
    message: 'Finding someone new...',
  }).catch(() => {/* best-effort */});

  // Add to queue idempotently — let the scheduler pick them up on next cycle
  try {
    await joinQueueEntry(getSupabase(), partnerId);
    console.log(`[MatchService] requeuePartner: ${partnerId} re-entered queue`);
    // Trigger one immediate match cycle to serve them without waiting 1.5s
    void safeRunGlobalMatchCycle();
  } catch (err) {
    console.warn(`[MatchService] requeuePartner: failed to re-queue ${partnerId}:`, err instanceof Error ? err.message : err);
  }
}

export async function nextPartner(sessionId: string, sessionToken: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const ended = await endActiveMatch(sessionId, 'next');

  if (ended?.match?.id) {
    await getSupabase().from('temporary_messages').delete().eq('match_id', ended.match.id);
  }

  if (ended?.partnerId) {
    await broadcastToSession(ended.partnerId, 'partner_left', { reason: 'next' });
    await requeuePartner(ended.partnerId);
  }

  await getSupabase()
    .from('connection_logs')
    .insert({ session_id: sessionId, event: 'next', details: {} });

  return joinQueue(sessionId, sessionToken);
}

export async function notifyPartnerLeft(sessionId: string, sessionToken: string, reason: MatchEndReason) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const ended = await endActiveMatch(sessionId, reason);

  if (ended?.match?.id) {
    await getSupabase().from('temporary_messages').delete().eq('match_id', ended.match.id);
  }

  if (ended?.partnerId) {
    await broadcastToSession(ended.partnerId, 'partner_left', { reason });
    await requeuePartner(ended.partnerId);
  }
}
