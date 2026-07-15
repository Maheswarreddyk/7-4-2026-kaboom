import { getSupabase, handleSupabaseError } from '../database/client.js';
import { getIceServers } from '../config/index.js';
import { broadcastToSession } from './broadcast.js';
import { leaveQueueEntry, joinQueueEntry, markUserReady, runMatchCycle, runGlobalMatchCycle, invalidateMatchmakerCache, transitionSessionStatus } from '../matchmaking/matchingEngine.js';
import { AnalyticsLogger } from '../analytics/logger.js';

export type MatchEndReason = 'next' | 'leave' | 'disconnect' | 'report';

import { acquireGlobalLock, releaseGlobalLock } from './lockService.js';

// ============================================================
// Global Cycle Distributed Mutex
// Prevents concurrent runGlobalMatchCycle() execution across
// multiple instances by using a Postgres-backed REST lock.
// ============================================================

export async function safeRunGlobalMatchCycle(): Promise<void> {
  const locked = await acquireGlobalLock();
  if (!locked) {
    console.log('[MatchService] Global cycle already running — skipping concurrent trigger');
    return;
  }
  
  try {
    await runGlobalMatchCycle(getSupabase());
  } finally {
    await releaseGlobalLock();
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

export async function endActiveMatch(sessionId: string, reason: MatchEndReason, targetMatchId?: string) {
  const match = await findActiveMatch(sessionId);
  if (!match) return null;

  // KS-007: Prevent Friendly Fire
  if (targetMatchId && match.id !== targetMatchId) {
    console.warn(`[MatchService] endActiveMatch blocked friendly fire: target ${targetMatchId} != active ${match.id}`);
    return null;
  }

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

  AnalyticsLogger.logEvent('CALL_ENDED', sessionId, match.id, {
    duration_sec: durationSeconds,
    reason
  }, `${match.id}_ended`);

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
  invalidateMatchmakerCache();
  const result = await runMatchCycle(getSupabase(), sessionId, sessionToken);
  // Trigger one immediate match cycle on join (V4.1 Requirement 8)
  void safeRunGlobalMatchCycle();
  return result;
}

export async function getMatchStatus(sessionId: string, sessionToken: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  const match = await findActiveMatch(sessionId);
  if (match) {
    // Re-construct the matched response payload identical to runMatchCycle
    const partnerId = match.user_a === sessionId ? match.user_b : match.user_a;
    const { data: partnerSession } = await getSupabase()
      .from('visitor_sessions')
      .select('display_name, bio, match_mode, match_constraints, match_attributes, city, state, country, gender, looking_for, languages, interest_tags')
      .eq('id', partnerId)
      .maybeSingle();

    return {
      status: 'matched' as const,
      matchId: match.id,
      partnerSessionId: partnerId,
      isInitiator: match.user_a === sessionId,
      iceServers: getIceServers(),
      queuePosition: 0,
      waitingSeconds: 0,
      matchReasonMetadata: match.match_reason_metadata,
      partnerProfile: partnerSession ? {
        displayName: partnerSession.display_name || 'Guest',
        bio: partnerSession.bio || '',
        matchMode: partnerSession.match_mode || 'RANDOM',
        matchConstraints: partnerSession.match_constraints || {},
        matchAttributes: partnerSession.match_attributes || {},
        city: partnerSession.city || null,
        state: partnerSession.state || null,
        country: partnerSession.country || null,
        gender: partnerSession.gender || null,
        lookingFor: partnerSession.looking_for || [],
        languages: partnerSession.languages || [],
        interestTags: partnerSession.interest_tags || [],
      } : null,
    };
  }

  // If no match, check if they are in queue
  const { data: queueEntry } = await getSupabase()
    .from('waiting_queue')
    .select('*')
    .eq('session_id', sessionId)
    .in('status', ['waiting', 'matched'])
    .maybeSingle();

  if (queueEntry) {
    return { status: 'waiting' as const };
  }

  return { status: 'idle' as const };
}

export async function markMatchReady(sessionId: string, sessionToken: string, matchId: string) {
  return markUserReady(getSupabase(), sessionId, sessionToken, matchId);
}

export async function leaveQueue(sessionId: string, sessionToken: string, targetMatchId?: string) {
  const session = await validateSession(sessionId, sessionToken);
  // Idempotent: if session is already gone/ended, treat as success (the user has already left)
  if (!session) return;
  await leaveQueueEntry(getSupabase(), sessionId);
  invalidateMatchmakerCache();
  const success = await transitionSessionStatus(getSupabase(), sessionId, 'READY', 'User manually left queue');
  
  // KS-005: The "Leave" Ghost Match protection
  if (!success) {
    console.warn(`[MatchService] leaveQueue transition to READY failed for ${sessionId}. They may have been caught by the matchmaker.`);
    // Attempt to end the ghost match just in case
    await endActiveMatch(sessionId, 'leave', targetMatchId);
    await transitionSessionStatus(getSupabase(), sessionId, 'READY', 'Aborted ghost match');
  }
}

/**
 * Re-queue a partner after their previous partner left.
 */
async function requeuePartner(partnerId: string): Promise<void> {
  const partner = await validateSession(partnerId);
  if (!partner) {
    console.log(`[MatchService] requeuePartner: session ${partnerId} not found or ended`);
    return;
  }

  // KS-006: Concurrent Skip Protection
  // If partner is already skipping or left, do not re-queue them.
  if (partner.status === 'REQUEUEING' || partner.status === 'SEARCHING' || partner.status === 'READY') {
    console.log(`[MatchService] requeuePartner: ${partnerId} is already ${partner.status}, skipping redundant requeue.`);
    return;
  }

  // Notify partner they are searching
  await broadcastToSession(partnerId, 'searching', {
    message: 'Finding someone new...',
  }).catch(() => {/* best-effort */});

  try {
    invalidateMatchmakerCache();
    await transitionSessionStatus(getSupabase(), partnerId, 'REQUEUEING', 'Requeueing partner');
    await joinQueueEntry(getSupabase(), partnerId);
    console.log(`[MatchService] requeuePartner: ${partnerId} re-entered queue`);
    // Trigger immediate match cycle to pair them instantly
    void safeRunGlobalMatchCycle();
  } catch (err) {
    console.warn(`[MatchService] requeuePartner: failed to re-queue ${partnerId}:`, err instanceof Error ? err.message : err);
  }
}

export async function nextPartner(sessionId: string, sessionToken: string, targetMatchId?: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  console.log(`[Next] Next clicked for session ${sessionId} (target match: ${targetMatchId})`);
  invalidateMatchmakerCache();

  // KS-006: If we are already requeuing or searching, silently drop redundant skips
  if (session.status === 'REQUEUEING' || session.status === 'SEARCHING') {
    console.warn(`[MatchService] nextPartner redundant skip blocked for ${sessionId} (status=${session.status})`);
    return { status: 'waiting' as const };
  }

  // Transition clicker state to REQUEUEING (V4.1 Requirement 8)
  const success = await transitionSessionStatus(getSupabase(), sessionId, 'REQUEUEING', 'User clicked Next');
  if (!success) {
    console.warn(`[MatchService] nextPartner failed transition to REQUEUEING for ${sessionId}`);
    return { status: 'waiting' as const };
  }

  // KS-007: Only end the specific match we intended to skip
  const ended = await endActiveMatch(sessionId, 'next', targetMatchId);

  // Perform cleanups in order (V4.1 Requirement 8)
  if (ended?.match?.id) {
    // Delete temporary messages
    await getSupabase().from('temporary_messages').delete().eq('match_id', ended.match.id);
    // Delete reservation
    await getSupabase().from('reservations').delete().eq('match_id', ended.match.id);
  }

  if (ended?.partnerId) {
    // Notify partner they are being requeued
    await transitionSessionStatus(getSupabase(), ended.partnerId, 'REQUEUEING', 'Partner clicked Next');
    await broadcastToSession(ended.partnerId, 'partner_left', { reason: 'next' });
    await requeuePartner(ended.partnerId);
  }

  await getSupabase()
    .from('connection_logs')
    .insert({ session_id: sessionId, event: 'next', details: {} });

  return joinQueue(sessionId, sessionToken);
}

export async function notifyPartnerLeft(sessionId: string, sessionToken: string, reason: MatchEndReason, targetMatchId?: string) {
  const session = await validateSession(sessionId, sessionToken);
  if (!session) throw new Error('Invalid session');

  console.log(`[Disconnect/Leave] Session ${sessionId} left, reason=${reason}, match=${targetMatchId}`);
  invalidateMatchmakerCache();

  // Transition leaving session status to READY or ENDED (V4.1 Requirement 8)
  await transitionSessionStatus(getSupabase(), sessionId, reason === 'leave' ? 'READY' : 'ENDED', 'User disconnected/left call');

  const ended = await endActiveMatch(sessionId, reason, targetMatchId);

  if (ended?.match?.id) {
    // Delete temporary messages
    await getSupabase().from('temporary_messages').delete().eq('match_id', ended.match.id);
    // Delete reservation
    await getSupabase().from('reservations').delete().eq('match_id', ended.match.id);
  }

  if (ended?.partnerId) {
    // Transition partner state to REQUEUEING
    await transitionSessionStatus(getSupabase(), ended.partnerId, 'REQUEUEING', 'Partner left call');
    await broadcastToSession(ended.partnerId, 'partner_left', { reason });
    await requeuePartner(ended.partnerId);
  }
}
