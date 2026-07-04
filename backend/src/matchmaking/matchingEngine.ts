import type { SupabaseClient } from '@supabase/supabase-js';
import { HEARTBEAT_STALE_MS } from './config.js';
import { getIceServers } from '../config/index.js';
import { broadcastToSession } from '../services/broadcast.js';
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
    if (!profileA || profileA.status !== 'waiting') continue;

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
      if (!profileB || profileB.status !== 'waiting') continue;

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
      supabase
        .from('visitor_sessions')
        .update({ status: 'matched', last_partner: userB })
        .eq('id', userA),
      supabase
        .from('visitor_sessions')
        .update({ status: 'matched', last_partner: userA })
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
    const iceServers = getIceServers();
    await Promise.all([
      broadcastToSession(userA, 'matched', {
        matchId: match.id,
        partnerSessionId: userB,
        isInitiator: userA === sessionIdA,
        iceServers,
      }),
      broadcastToSession(userB, 'matched', {
        matchId: match.id,
        partnerSessionId: userA,
        isInitiator: userB === sessionIdA,
        iceServers,
      }),
    ]);

    // Mark both as processed in this matchmaking pass
    matchedOrReservedInCycle.add(sessionIdA);
    matchedOrReservedInCycle.add(sessionIdB);

    console.log(`[Matchmaker] Successfully created match ${match.id} for ${sessionIdA} and ${sessionIdB}`);
  }

  console.log(`[Matchmaker] Finished global matching cycle in ${Date.now() - start}ms.`);
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

  // 1. Join queue (idempotent)
  const queueResult = await joinQueueEntry(supabase, sessionId);
  const waitingSeconds = queueResult.waitingSeconds;

  // 2. If they already have an active match, return it
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

  // 3. Run the global matching cycle to try matching users
  await runGlobalMatchCycle(supabase);

  // 4. Re-check if this user got matched during the global matching cycle
  const newMatch = await findActiveMatch(supabase, sessionId);
  if (newMatch) {
    const partnerId = newMatch.user_a === sessionId ? newMatch.user_b : newMatch.user_a;
    return {
      status: 'matched',
      matchId: newMatch.id,
      partnerSessionId: partnerId,
      isInitiator: newMatch.user_a === sessionId,
      iceServers: getIceServers(),
      queuePosition: 0,
      waitingSeconds,
    };
  }

  // 5. Still waiting
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
  console.log(`\n======================================================`);
  console.log(`[API /ready] INSTRUMENTATION LOG`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Match ID: ${matchId}`);

  try {
    // 1. Database Lookups and Verification
    console.log(`[API /ready] Querying visitor_sessions...`);
    const { data: session, error: sessErr } = await supabase
      .from('visitor_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessErr) {
      console.error(`[API /ready] SQL Error during session lookup:`, sessErr);
    }
    console.log(`Session Lookup Result:`, session ? `Found (status: ${session.status})` : 'Not Found');

    if (!session || session.session_token !== sessionToken) {
      console.error(`[API /ready] Session validation failed. Expected token match.`);
      throw new Error('Invalid session or session token mismatch');
    }

    console.log(`[API /ready] Querying matches...`);
    const { data: match, error: matchErr } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .is('ended_at', null)
      .maybeSingle();

    if (matchErr) {
      console.error(`[API /ready] SQL Error during match lookup:`, matchErr);
    }
    console.log(`Match Lookup Result:`, match ? `Active match found (user_a: ${match.user_a}, user_b: ${match.user_b})` : 'No active match found');

    if (!match) {
      throw new Error(`Match not found or already ended. ID: ${matchId}`);
    }

    const isUserA = match.user_a === sessionId;
    const isUserB = match.user_b === sessionId;
    if (!isUserA && !isUserB) {
      console.error(`[API /ready] Security violation: Session ${sessionId} is not a participant in match ${matchId}`);
      throw new Error('Not a participant in this match');
    }

    // Lookup reservation
    console.log(`[API /ready] Querying reservations...`);
    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resErr) {
      console.error(`[API /ready] SQL Error during reservation lookup:`, resErr);
    }
    console.log(`Reservation Lookup Result:`, reservation ? `Found reservation (status: ${reservation.status})` : 'No reservation found');

    // Lookup queue entry
    console.log(`[API /ready] Querying waiting_queue...`);
    const { data: queueEntry, error: qErr } = await supabase
      .from('waiting_queue')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (qErr) {
      console.error(`[API /ready] SQL Error during queue lookup:`, qErr);
    }
    console.log(`Queue Entry Lookup Result:`, queueEntry ? `Found (status: ${queueEntry.status})` : 'No queue entry found');

    const expectedState = 'user_ready = false';
    const actualState = `user_a_ready: ${match.user_a_ready}, user_b_ready: ${match.user_b_ready}`;
    console.log(`Expected State: ${expectedState} | Actual State: ${actualState}`);

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
      
      if (updateErr) {
        console.error(`[API /ready] SQL Error updating match ready state:`, updateErr);
      }
      if (updated) {
        dbBothReady = Boolean(updated.user_a_ready && updated.user_b_ready);
        console.log(`Updated Match Ready State: user_a_ready: ${updated.user_a_ready}, user_b_ready: ${updated.user_b_ready}`);
      }
    } catch (err) {
      console.warn(`[API /ready] Failed to write ready flag to DB (columns may be optional):`, err);
    }

    const memoryReady = readySessionsByMatch.get(matchId)!;
    const bothReady =
      dbBothReady ||
      (memoryReady.has(match.user_a) && memoryReady.has(match.user_b));

    console.log(`Negotiation readiness check: memoryReady: ${Array.from(memoryReady).join(', ')} | bothReady: ${bothReady}`);

    if (bothReady) {
      console.log(`[API /ready] Both users are ready! Starting WebRTC negotiation...`);
      try {
        await supabase.from('matches').update({ negotiation_started: true }).eq('id', matchId);
      } catch (err) {
        console.warn('[API /ready] Failed to update negotiation_started flag in DB:', err);
      }

      const partnerId = isUserA ? match.user_b : match.user_a;
      const iceServers = getIceServers();

      console.log(`[API /ready] Broadcasting start_negotiation to initiator ${sessionId} and partner ${partnerId}...`);
      await Promise.all([
        (async () => {
          try {
            await broadcastToSession(sessionId, 'start_negotiation', {
              matchId,
              partnerSessionId: partnerId,
              isInitiator: isUserA,
              iceServers,
            });
            console.log(`[API /ready] Broadcast success to ${sessionId}`);
          } catch (bErr) {
            console.warn(`[API /ready] Failed to broadcast to session ${sessionId}:`, bErr instanceof Error ? bErr.message : bErr);
          }
        })(),
        (async () => {
          try {
            await broadcastToSession(partnerId, 'start_negotiation', {
              matchId,
              partnerSessionId: sessionId,
              isInitiator: !isUserA,
              iceServers,
            });
            console.log(`[API /ready] Broadcast success to ${partnerId}`);
          } catch (bErr) {
            console.warn(`[API /ready] Failed to broadcast to partner ${partnerId}:`, bErr instanceof Error ? bErr.message : bErr);
          }
        })()
      ]);

      await logToDb(supabase, sessionId, 'negotiation_start', { matchId });
      readySessionsByMatch.delete(matchId);
    }

    console.log(`[API /ready] Finished processing. returning bothReady: ${bothReady}, isInitiator: ${isUserA}`);
    console.log(`======================================================\n`);
    return { bothReady, isInitiator: isUserA };
  } catch (error) {
    console.error(`[API /ready] CRITICAL EXCEPTION CAUGHT:`);
    console.error(error instanceof Error ? error.stack : error);
    console.log(`======================================================\n`);
    throw error;
  }
}
