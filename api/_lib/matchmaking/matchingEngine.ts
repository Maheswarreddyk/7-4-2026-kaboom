import type { SupabaseClient } from '@supabase/supabase-js';
import { getIceServers } from '../config.js';
import { broadcastToSession } from '../realtime.js';
import {
  expireStaleReservations,
  getReservedSessionIds,
  joinQueueEntry,
  leaveQueueEntry,
  loadWaitingCandidates,
} from './queueEngine.js';
import {
  calculateCompatibility,
  rankCandidates,
  type SessionProfile,
} from './scoringEngine.js';
import {
  confirmReservation,
  createReservation,
  rollbackReservation,
} from './reservationEngine.js';
import { logEngine, logToDb } from './logger.js';

export interface MatchResult {
  status: 'waiting' | 'matched';
  matchId?: string;
  partnerSessionId?: string;
  isInitiator?: boolean;
  iceServers?: ReturnType<typeof getIceServers>;
  queuePosition?: number;
  message?: string;
  waitingSeconds?: number;
}

async function findActiveMatch(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .is('ended_at', null)
    .or(`user_a.eq.${sessionId},user_b.eq.${sessionId}`)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadExclusionSets(supabase: SupabaseClient, sessionId: string) {
  const [recentMatchesQuery, reportsQuery] = await Promise.all([
    supabase
      .from('matches')
      .select('user_a, user_b')
      .or(`user_a.eq.${sessionId},user_b.eq.${sessionId}`)
      .order('started_at', { ascending: false })
      .limit(5),
    supabase
      .from('reports')
      .select('reporter_session, reported_session')
      .or(`reporter_session.eq.${sessionId},reported_session.eq.${sessionId}`),
  ]);

  const recentPartners = new Set<string>();
  recentMatchesQuery.data?.forEach((m) => {
    recentPartners.add(m.user_a === sessionId ? m.user_b : m.user_a);
  });

  const reportedIds = new Set<string>();
  reportsQuery.data?.forEach((r) => {
    reportedIds.add(
      r.reporter_session === sessionId ? r.reported_session : r.reporter_session
    );
  });

  return { recentPartners, reportedIds };
}

/**
 * Event-driven match cycle: load → filter → score → reserve → confirm → publish.
 */
export async function runMatchCycle(
  supabase: SupabaseClient,
  sessionId: string,
  sessionToken: string
): Promise<MatchResult> {
  const cycleStart = Date.now();

  const { data: session, error: sessionErr } = await supabase
    .from('visitor_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionErr || !session || session.session_token !== sessionToken || session.status === 'ended') {
    logEngine({
      engine: 'MatchingEngine',
      sessionId,
      success: false,
      reason: 'Invalid session',
      durationMs: Date.now() - cycleStart,
    });
    throw new Error('Invalid session');
  }

  const existingMatch = await findActiveMatch(supabase, sessionId);
  if (existingMatch) {
    const partnerId =
      existingMatch.user_a === sessionId ? existingMatch.user_b : existingMatch.user_a;
    return {
      status: 'matched',
      matchId: existingMatch.id,
      partnerSessionId: partnerId,
      isInitiator: existingMatch.user_a === sessionId,
      iceServers: getIceServers(),
      queuePosition: 0,
    };
  }

  await expireStaleReservations(supabase);

  const queueResult = await joinQueueEntry(supabase, sessionId);
  const waitingSeconds = queueResult.waitingSeconds;

  const candidates = await loadWaitingCandidates(supabase, sessionId);
  const reservedIds = await getReservedSessionIds(supabase);
  const { recentPartners, reportedIds } = await loadExclusionSets(supabase, sessionId);

  const selfProfile = session as SessionProfile;
  const scored: Array<ReturnType<typeof calculateCompatibility> & { sessionId: string }> = [];

  for (const entry of candidates) {
    if (reservedIds.has(entry.session_id)) continue;

    const rawProfile = entry.visitor_sessions;
    const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as SessionProfile;
    if (!profile?.id) continue;
    if (profile.status === 'matched' || profile.status === 'ended') continue;

    const score = calculateCompatibility(
      selfProfile,
      profile,
      waitingSeconds,
      recentPartners,
      reportedIds
    );

    if (score) {
      scored.push({ ...score, sessionId: profile.id });
    }
  }

  let ranked = rankCandidates(scored, waitingSeconds);

  if (scored.length === 1) {
    ranked = [{ ...scored[0], rank: 1, passesThreshold: true }];
    logEngine({
      engine: 'MatchingEngine',
      sessionId,
      success: true,
      reason: 'Single candidate available — immediate match',
      details: { score: scored[0].weightedScore },
    });
  } else if (ranked.length === 0 && scored.length > 0 && waitingSeconds >= 3) {
    const bestFallback = [...scored].sort((a, b) => {
      if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
      return 0;
    })[0];
    ranked = [{ ...bestFallback, rank: 1, passesThreshold: true }];
    logEngine({
      engine: 'MatchingEngine',
      sessionId,
      success: true,
      reason: 'Adaptive fallback: matching best available candidate',
      details: { waitingSeconds, score: bestFallback.weightedScore },
    });
  }

  if (ranked.length === 0) {
    const { count } = await supabase
      .from('waiting_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');

    logEngine({
      engine: 'MatchingEngine',
      sessionId,
      queueId: queueResult.queueId,
      success: true,
      reason: 'No eligible candidates',
      durationMs: Date.now() - cycleStart,
      details: { waitingSeconds, candidateCount: candidates.length },
    });

    return {
      status: 'waiting',
      queuePosition: count ?? 1,
      message: 'Waiting for a partner...',
      waitingSeconds,
    };
  }

  const best = ranked[0];
  const partnerSessionId = best.sessionId;

  const reservation = await createReservation(supabase, sessionId, partnerSessionId);

  const userA = sessionId < partnerSessionId ? sessionId : partnerSessionId;
  const userB = sessionId < partnerSessionId ? partnerSessionId : sessionId;

  const matchInsert: Record<string, unknown> = {
    user_a: userA,
    user_b: userB,
    match_score: best.weightedScore,
    matched_reason: best.reason,
  };

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert(matchInsert)
    .select()
    .single();

  if (matchError || !match) {
    const existing = await findActiveMatch(supabase, sessionId);
    if (existing) {
      const partnerId = existing.user_a === sessionId ? existing.user_b : existing.user_a;
      return {
        status: 'matched',
        matchId: existing.id,
        partnerSessionId: partnerId,
        isInitiator: existing.user_a === sessionId,
        iceServers: getIceServers(),
        queuePosition: 0,
        waitingSeconds,
      };
    }
    await rollbackReservation(supabase, reservation.reservationId, matchError?.message ?? 'Match insert failed');
    throw matchError ?? new Error('Failed to create match');
  }

  await confirmReservation(supabase, reservation.reservationId, match.id);

  await Promise.all([
    supabase
      .from('waiting_queue')
      .update({ status: 'matched' })
      .in('session_id', [userA, userB])
      .eq('status', 'waiting'),
    supabase
      .from('visitor_sessions')
      .update({ status: 'matched', last_partner: userB })
      .eq('id', userA),
    supabase
      .from('visitor_sessions')
      .update({ status: 'matched', last_partner: userA })
      .eq('id', userB),
  ]);

  await logToDb(supabase, userA, 'match_start', {
    matchId: match.id,
    partnerId: userB,
    score: best.weightedScore,
    rawScore: best.rawScore,
    threshold: best.threshold,
    phase: best.phase,
    rank: best.rank,
    reason: best.reason,
  });

  await logToDb(supabase, userB, 'match_start', {
    matchId: match.id,
    partnerId: userA,
  });

  const iceServers = getIceServers();
  const isInitiator = sessionId === userA;

  if (sessionId === userA) {
    await broadcastToSession(userB, 'matched', {
      matchId: match.id,
      partnerSessionId: userA,
      isInitiator: false,
      iceServers,
    });
  } else {
    await broadcastToSession(userA, 'matched', {
      matchId: match.id,
      partnerSessionId: userB,
      isInitiator: false,
      iceServers,
    });
  }

  logEngine({
    engine: 'MatchingEngine',
    sessionId,
    queueId: queueResult.queueId,
    reservationId: reservation.reservationId,
    matchId: match.id,
    success: true,
    reason: 'Match created and partner notified',
    durationMs: Date.now() - cycleStart,
    details: {
      partnerSessionId,
      weightedScore: best.weightedScore,
      rawScore: best.rawScore,
      threshold: best.threshold,
      phase: best.phase,
      rank: best.rank,
    },
  });

  return {
    status: 'matched',
    matchId: match.id,
    partnerSessionId,
    isInitiator,
    iceServers,
    queuePosition: 0,
    waitingSeconds,
  };
}

export { leaveQueueEntry };

const readySessionsByMatch = new Map<string, Set<string>>();

/**
 * Mark user READY; when both ready, broadcast START_NEGOTIATION to both sessions.
 */
export async function markUserReady(
  supabase: SupabaseClient,
  sessionId: string,
  sessionToken: string,
  matchId: string
): Promise<{ bothReady: boolean; isInitiator: boolean }> {
  const { data: session } = await supabase
    .from('visitor_sessions')
    .select('session_token')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.session_token !== sessionToken) {
    throw new Error('Invalid session');
  }

  const { data: match, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .is('ended_at', null)
    .maybeSingle();

  if (error || !match) throw new Error('Match not found');

  const isUserA = match.user_a === sessionId;
  const isUserB = match.user_b === sessionId;
  if (!isUserA && !isUserB) throw new Error('Not a participant');

  await logToDb(supabase, sessionId, 'ready', { matchId });

  if (!readySessionsByMatch.has(matchId)) {
    readySessionsByMatch.set(matchId, new Set());
  }
  readySessionsByMatch.get(matchId)!.add(sessionId);

  let dbBothReady = false;
  try {
    const readyUpdate = isUserA ? { user_a_ready: true } : { user_b_ready: true };
    const { data: updated, error: updateErr } = await supabase
      .from('matches')
      .update(readyUpdate)
      .eq('id', matchId)
      .select()
      .single();
    if (!updateErr && updated) {
      dbBothReady = Boolean(updated.user_a_ready && updated.user_b_ready);
    }
  } catch {
    // READY columns optional until migration 005
  }

  const memoryReady = readySessionsByMatch.get(matchId)!;
  const bothReady =
    dbBothReady ||
    (memoryReady.has(match.user_a) && memoryReady.has(match.user_b));

  if (bothReady) {
    try {
      await supabase.from('matches').update({ negotiation_started: true }).eq('id', matchId);
    } catch {
      // optional column
    }

    const partnerId = isUserA ? match.user_b : match.user_a;
    const iceServers = getIceServers();

    await Promise.all([
      broadcastToSession(sessionId, 'start_negotiation', {
        matchId,
        partnerSessionId: partnerId,
        isInitiator: isUserA,
        iceServers,
      }),
      broadcastToSession(partnerId, 'start_negotiation', {
        matchId,
        partnerSessionId: sessionId,
        isInitiator: !isUserA,
        iceServers,
      }),
    ]);

    await logToDb(supabase, sessionId, 'negotiation_start', { matchId });
    readySessionsByMatch.delete(matchId);
  }

  return { bothReady, isInitiator: isUserA };
}
