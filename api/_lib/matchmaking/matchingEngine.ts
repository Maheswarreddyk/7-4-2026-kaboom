import type { SupabaseClient } from '@supabase/supabase-js';
import { HEARTBEAT_STALE_MS } from './config.js';
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
 * Global event-driven matchmaking cycle.
 * Loads all waiting users, filters them, finds the best matches, and sets up matches.
 */
export async function runGlobalMatchCycle(supabase: SupabaseClient): Promise<void> {
  const start = Date.now();
  console.log('[Matchmaker] Starting global matching cycle...');

  // 1. Expire any stale reservations first to return users to the queue
  const expiredCount = await expireStaleReservations(supabase);
  if (expiredCount > 0) {
    console.log(`[Matchmaker] Expired ${expiredCount} stale reservations.`);
  }

  // 2. Load all waiting queue entries
  const heartbeatThreshold = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();
  const { data: waitingQueue, error: queueErr } = await supabase
    .from('waiting_queue')
    .select(`
      session_id,
      joined_at,
      visitor_sessions:session_id (
        id,
        session_token,
        gender,
        looking_for,
        languages,
        country,
        state,
        district,
        city,
        interest_tags,
        last_partner,
        queue_entered_at,
        last_activity,
        status
      )
    `)
    .eq('status', 'waiting')
    .order('joined_at', { ascending: true }); // Oldest waiting first!

  if (queueErr) {
    console.error('[Matchmaker] Failed to load waiting queue:', queueErr.message);
    return;
  }

  if (!waitingQueue || waitingQueue.length < 2) {
    console.log('[Matchmaker] Not enough waiting users to run matching. Waiting count:', waitingQueue?.length ?? 0);
    return;
  }

  // Filter candidates active within heartbeat threshold
  let activeWaiting = (waitingQueue as any[]).filter((entry) => {
    const profile = entry.visitor_sessions;
    if (!profile) return false;
    const lastActivity = profile.last_activity;
    return lastActivity && lastActivity >= heartbeatThreshold;
  });

  console.log(`[Matchmaker] Found ${activeWaiting.length} active waiting users.`);

  if (activeWaiting.length < 2) return;

  // Track users already processed in this cycle to avoid duplicate matches
  const matchedOrReservedInCycle = new Set<string>();

  // Fetch all active reservations to check global reservation state
  const reservedIds = await getReservedSessionIds(supabase);

  // 3. Match from oldest to newest
  for (let i = 0; i < activeWaiting.length; i++) {
    const entryA = activeWaiting[i];
    const sessionIdA = entryA.session_id;

    if (matchedOrReservedInCycle.has(sessionIdA) || reservedIds.has(sessionIdA)) continue;

    const profileA = entryA.visitor_sessions;
    // Phase 3: Check for 'SEARCHING' (FSM uppercase) — Phase 2 corrected join to write 'SEARCHING'
    if (!profileA || profileA.status !== 'SEARCHING') continue;

    // Load recent matches and reports for user A to build exclusion sets
    const { recentPartners, reportedIds } = await loadExclusionSets(supabase, sessionIdA);

    const waitingSecondsA = Math.floor((Date.now() - new Date(entryA.joined_at).getTime()) / 1000);

    const scoredCandidates: Array<ReturnType<typeof calculateCompatibility> & { sessionId: string; entry: any }> = [];

    // Find best compatible candidate B among the remaining candidates
    for (let j = 0; j < activeWaiting.length; j++) {
      const entryB = activeWaiting[j];
      const sessionIdB = entryB.session_id;

      if (sessionIdA === sessionIdB) continue;
      if (matchedOrReservedInCycle.has(sessionIdB) || reservedIds.has(sessionIdB)) continue;

      const profileB = entryB.visitor_sessions;
      // Phase 3: Check for 'SEARCHING' (FSM uppercase)
      if (!profileB || profileB.status !== 'SEARCHING') continue;

      const score = calculateCompatibility(
        profileA,
        profileB,
        waitingSecondsA,
        recentPartners,
        reportedIds
      );

      if (score) {
        scoredCandidates.push({ ...score, sessionId: sessionIdB, entry: entryB });
      }
    }

    let ranked = rankCandidates(scoredCandidates, waitingSecondsA);

    if (scoredCandidates.length === 1) {
      ranked = [{ ...scoredCandidates[0], rank: 1, passesThreshold: true }];
    } else if (ranked.length === 0 && scoredCandidates.length > 0 && waitingSecondsA >= 30) {
      // Relax requirements after 30 seconds
      const bestFallback = [...scoredCandidates].sort((a, b) => b.weightedScore - a.weightedScore)[0];
      ranked = [{ ...bestFallback, rank: 1, passesThreshold: true }];
    }

    if (ranked.length === 0) {
      console.log(`[Matchmaker] No compatible candidates for session ${sessionIdA} (waiting ${waitingSecondsA}s)`);
      continue;
    }

    // Found a match!
    const bestMatch = ranked[0];
    const sessionIdB = bestMatch.sessionId;

    console.log(`[Matchmaker] Found match between ${sessionIdA} and ${sessionIdB} with score ${bestMatch.weightedScore}`);

    // Create reservation atomically
    const reservation = await createReservation(supabase, sessionIdA, sessionIdB);
    if (!reservation.success) {
      console.error(`[Matchmaker] Failed to reserve: ${reservation.reason}`);
      continue;
    }

    const userA = sessionIdA < sessionIdB ? sessionIdA : sessionIdB;
    const userB = sessionIdA < sessionIdB ? sessionIdB : sessionIdA;

    // Create match row
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        user_a: userA,
        user_b: userB,
        match_score: bestMatch.weightedScore,
        matched_reason: bestMatch.reason,
        match_reason_metadata: bestMatch.reasonMetadata,
      })
      .select()
      .single();

    if (matchError || !match) {
      console.error(`[Matchmaker] Match creation failed between ${userA} and ${userB}:`, matchError?.message);
      await rollbackReservation(supabase, reservation.reservationId, matchError?.message ?? 'Match insert failed');
      continue;
    }

    // Confirm reservation
    await confirmReservation(supabase, reservation.reservationId, match.id);

    // Update statuses in DB
    await Promise.all([
      supabase
        .from('waiting_queue')
        .update({ status: 'matched' })
        .in('session_id', [userA, userB])
        .eq('status', 'waiting'),
      // Phase 3: Corrected from lowercase 'matched' to uppercase 'MATCHED' (FSM consistency)
      supabase
        .from('visitor_sessions')
        .update({ status: 'MATCHED', last_partner: userB })
        .eq('id', userA),
      supabase
        .from('visitor_sessions')
        .update({ status: 'MATCHED', last_partner: userA })
        .eq('id', userB),
    ]);

    // Log match starts
    await Promise.all([
      logToDb(supabase, userA, 'match_start', {
        matchId: match.id,
        partnerId: userB,
        score: bestMatch.weightedScore,
        rawScore: bestMatch.rawScore,
        threshold: bestMatch.threshold,
        phase: bestMatch.phase,
        rank: bestMatch.rank,
        reason: bestMatch.reason,
      }),
      logToDb(supabase, userB, 'match_start', {
        matchId: match.id,
        partnerId: userA,
      }),
    ]);

    // Broadcast matched event to both sessions
    // Phase 3: Added .catch() guards — a broadcast failure must not corrupt match state
    const iceServers = getIceServers();
    await Promise.all([
      broadcastToSession(userA, 'matched', {
        matchId: match.id,
        partnerSessionId: userB,
        isInitiator: userA === sessionIdA,
        iceServers,
      }).catch((e) => console.error(`[Matchmaker] Broadcast to ${userA} failed:`, e?.message)),
      broadcastToSession(userB, 'matched', {
        matchId: match.id,
        partnerSessionId: userA,
        isInitiator: userB === sessionIdA,
        iceServers,
      }).catch((e) => console.error(`[Matchmaker] Broadcast to ${userB} failed:`, e?.message)),
    ]);

    // Mark both as processed in this matchmaking pass
    matchedOrReservedInCycle.add(sessionIdA);
    matchedOrReservedInCycle.add(sessionIdB);

    console.log(`[Matchmaker] Successfully created match ${match.id} for ${sessionIdA} and ${sessionIdB}`);
  }

  console.log(`[Matchmaker] Finished global matching cycle in ${Date.now() - start}ms.`);
}

/**
 * Per-request match status check: join queue → check for active match → return status.
 *
 * Phase 1B: runGlobalMatchCycle() has been removed from this function.
 * Reason: Running a full O(n²) scoring pass on every /match/join heartbeat (every 4s per user)
 * causes quadratic DB load at scale. The global match cycle is now run exclusively by the
 * persistent backend MatchScheduler (1,500ms interval) which uses a mutex and advisory DB lock.
 * Users will be matched within 1,500ms of the scheduler's next tick — well within the 4,000ms
 * frontend polling interval. API contract and response shape are unchanged.
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

  // 1. Join queue (idempotent — safe to call on every heartbeat)
  const queueResult = await joinQueueEntry(supabase, sessionId);
  const waitingSeconds = queueResult.waitingSeconds;

  // 2. Check if this user was matched by the backend scheduler
  const existingMatch = await findActiveMatch(supabase, sessionId);
  if (existingMatch) {
    const partnerId = existingMatch.user_a === sessionId ? existingMatch.user_b : existingMatch.user_a;
    return {
      status: 'matched',
      matchId: existingMatch.id,
      partnerSessionId: partnerId,
      isInitiator: existingMatch.user_a === sessionId,
      iceServers: getIceServers(),
      queuePosition: 0,
      waitingSeconds,
    };
  }

  // 3. Still waiting — return queue position
  const { count } = await supabase
    .from('waiting_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'waiting');

  return {
    status: 'waiting',
    queuePosition: count ?? 1,
    message: 'Waiting for a partner...',
    waitingSeconds,
  };
}

export { leaveQueueEntry };

// Phase 1A: readySessionsByMatch in-memory Map removed.
// Reason: module-level Maps are reset on every Vercel function invocation.
// DB columns user_a_ready / user_b_ready are the authoritative source.

/**
 * Mark user READY; when both ready, broadcast START_NEGOTIATION to both sessions.
 *
 * Phase 1A: Uses DB-only state (user_a_ready / user_b_ready columns).
 * The in-memory readySessionsByMatch Map has been removed because module-level
 * state does not persist across Vercel function invocations.
 */
export async function markUserReady(
  supabase: SupabaseClient,
  sessionId: string,
  sessionToken: string,
  matchId: string
): Promise<{ bothReady: boolean; isInitiator: boolean }> {
  // 1. Validate session
  const { data: session } = await supabase
    .from('visitor_sessions')
    .select('session_token')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.session_token !== sessionToken) {
    throw new Error('Invalid session');
  }

  // 2. Load match — also check if negotiation already started (handles refresh/retry)
  const { data: match, error } = await supabase
    .from('matches')
    .select('id, user_a, user_b, user_a_ready, user_b_ready, negotiation_started')
    .eq('id', matchId)
    .is('ended_at', null)
    .maybeSingle();

  if (error || !match) throw new Error('Match not found');

  const isUserA = match.user_a === sessionId;
  const isUserB = match.user_b === sessionId;
  if (!isUserA && !isUserB) throw new Error('Not a participant');

  // If negotiation already started, re-broadcast to handle the case where
  // one peer refreshed and missed the original start_negotiation event.
  if (match.negotiation_started) {
    const partnerId = isUserA ? match.user_b : match.user_a;
    const iceServers = getIceServers();
    await Promise.all([
      broadcastToSession(sessionId, 'start_negotiation', {
        matchId,
        partnerSessionId: partnerId,
        isInitiator: isUserA,
        iceServers,
      }).catch(() => { /* best-effort re-broadcast */ }),
      broadcastToSession(partnerId, 'start_negotiation', {
        matchId,
        partnerSessionId: sessionId,
        isInitiator: !isUserA,
        iceServers,
      }).catch(() => { /* best-effort re-broadcast */ }),
    ]);
    return { bothReady: true, isInitiator: isUserA };
  }

  await logToDb(supabase, sessionId, 'ready', { matchId });

  // 3. Write THIS user's ready flag and read back both flags in one round-trip
  const readyUpdate = isUserA ? { user_a_ready: true } : { user_b_ready: true };
  const { data: updated, error: updateErr } = await supabase
    .from('matches')
    .update(readyUpdate)
    .eq('id', matchId)
    .select('user_a_ready, user_b_ready')
    .single();

  if (updateErr || !updated) {
    throw new Error('Failed to record ready state');
  }

  const bothReady = Boolean(updated.user_a_ready && updated.user_b_ready);

  if (bothReady) {
    // 4. Atomically mark negotiation_started to prevent double-broadcast
    //    on concurrent ready calls. Only proceed if we set the flag.
    const { error: flagErr } = await supabase
      .from('matches')
      .update({ negotiation_started: true })
      .eq('id', matchId)
      .eq('negotiation_started', false); // Only update if not already set

    if (flagErr) {
      // Another instance already handled this — do not double-broadcast
      return { bothReady: true, isInitiator: isUserA };
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
  }

  return { bothReady, isInitiator: isUserA };
}
