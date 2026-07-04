import { getSupabase, handleSupabaseError } from '../database/client.js';
import { getIceServers } from '../config/index.js';
import { broadcastToSession } from './broadcast.js';
import { leaveQueueEntry, markUserReady, runMatchCycle } from '../matchmaking/matchingEngine.js';

export type MatchEndReason = 'next' | 'leave' | 'disconnect' | 'report';

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

async function requeuePartner(partnerId: string) {
  const partner = await validateSession(partnerId);
  if (!partner) return;

  await broadcastToSession(partnerId, 'searching', {
    message: 'Finding someone new...',
  });

  try {
    await joinQueue(partnerId, partner.session_token);
  } catch {
    // Partner re-queue is best-effort
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
