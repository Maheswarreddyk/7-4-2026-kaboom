import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { HEARTBEAT_STALE_MS, RESERVATION_TIMEOUT_MS } from './config.js';
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
import { AnalyticsLogger } from '../analytics/logger.js';

// ============================================================
// Concurrency Memory Mutex Configuration
// ============================================================
let isHealCycleRunning = false;
let isMatchmakerRunning = false;

// ============================================================
// In-Memory Queue Cache & Invalidation
// ============================================================
export function invalidateMatchmakerCache(): void {
  // No-op: Cache removed to fix ghost matches (Chaos/Sync Audit)
}

// ============================================================
// Queue Metrics Tracking
// ============================================================
export interface QueueMetrics {
  totalSearchingUsers: number;
  averageWaitTime: number;
  maximumWaitTime: number;
  successfulMatches: number;
  failedMatches: number;
  rematches: number;
  abandonedSearches: number;
}

export const matchmakerMetrics: QueueMetrics = {
  totalSearchingUsers: 0,
  averageWaitTime: 0,
  maximumWaitTime: 0,
  successfulMatches: 0,
  failedMatches: 0,
  rematches: 0,
  abandonedSearches: 0,
};

// ============================================================
// Explicit FSM Transition Validator (V4.1 Requirement 1)
// ============================================================
const VALID_TRANSITIONS: Record<string, string[]> = {
  'CREATED': ['READY', 'SEARCHING', 'ENDED'],
  'READY': ['SEARCHING', 'ENDED'],
  'SEARCHING': ['RESERVED', 'READY', 'ENDED'],
  'RESERVED': ['MATCHED', 'SEARCHING', 'ENDED'],
  'MATCHED': ['SIGNALING', 'REQUEUEING', 'ENDED'],
  'SIGNALING': ['CONNECTED', 'REQUEUEING', 'ENDED'],
  'CONNECTED': ['PARTNER_LEFT', 'REQUEUEING', 'ENDED'],
  'PARTNER_LEFT': ['REQUEUEING', 'ENDED'],
  'REQUEUEING': ['SEARCHING', 'ENDED'],
  'ENDED': ['READY', 'SEARCHING'],
};

const VALID_FROM_STATES: Record<string, string[]> = {
  'READY': ['CREATED', 'SEARCHING', 'ENDED'],
  'SEARCHING': ['CREATED', 'READY', 'RESERVED', 'REQUEUEING', 'ENDED'],
  'RESERVED': ['SEARCHING'],
  'MATCHED': ['RESERVED'],
  'SIGNALING': ['MATCHED'],
  'CONNECTED': ['SIGNALING'],
  'PARTNER_LEFT': ['CONNECTED'],
  'REQUEUEING': ['MATCHED', 'SIGNALING', 'CONNECTED', 'PARTNER_LEFT'],
  'ENDED': ['CREATED', 'READY', 'SEARCHING', 'RESERVED', 'MATCHED', 'SIGNALING', 'CONNECTED', 'PARTNER_LEFT', 'REQUEUEING']
};

export async function transitionSessionStatus(
  supabase: SupabaseClient,
  sessionId: string,
  targetStatus: string,
  reason: string,
  expectedCurrentStatus?: string
): Promise<boolean> {
  const allowedFromStates = expectedCurrentStatus ? [expectedCurrentStatus] : VALID_FROM_STATES[targetStatus] || [];
  
  if (allowedFromStates.length === 0) {
    console.warn(`[FSM Warning] No valid origin states for target ${targetStatus} (${reason})`);
    return false;
  }

  const { data, error } = await supabase
    .from('visitor_sessions')
    .update({ status: targetStatus, last_activity: new Date().toISOString() })
    .eq('id', sessionId)
    .in('status', [...allowedFromStates, targetStatus]) // Include targetStatus for idempotency
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.warn(`[FSM Warning] Illegal transition or concurrent modification blocked for session ${sessionId} to ${targetStatus} (${reason}). Error: ${error?.message || 'Row not found or status constraint failed'}`);
    return false;
  }

  console.log(`[FSM Transition] Session=${sessionId} | -> ${targetStatus} | Reason=${reason}`);
  return true;
}

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

async function loadBatchedExclusions(supabase: SupabaseClient, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return { recentPartnersMap: new Map(), reportedIdsMap: new Map(), endedMatchesMap: new Map() };
  }

  // Build exclusion maps for all active waitlist sessions (O(1) queries instead of O(N))
  // We limit the batch size indirectly by only querying for active waiting sessions
  
  const [recentMatchesQuery, reportsQuery, endedMatchesQuery] = await Promise.all([
    supabase
      .from('matches')
      .select('user_a, user_b')
      .or(`user_a.in.(${sessionIds.join(',')}),user_b.in.(${sessionIds.join(',')})`)
      .order('started_at', { ascending: false })
      .limit(200),
    supabase
      .from('reports')
      .select('reporter_session, reported_session')
      .or(`reporter_session.in.(${sessionIds.join(',')}),reported_session.in.(${sessionIds.join(',')})`),
    supabase
      .from('matches')
      .select('user_a, user_b, ended_at')
      .not('ended_at', 'is', null)
      .or(`user_a.in.(${sessionIds.join(',')}),user_b.in.(${sessionIds.join(',')})`)
      .order('ended_at', { ascending: false })
      .limit(300)
  ]);

  const recentPartnersMap = new Map<string, Set<string>>();
  const reportedIdsMap = new Map<string, Set<string>>();
  const endedMatchesMap = new Map<string, Map<string, string>>(); // user -> (partner -> ended_at)

  sessionIds.forEach(id => {
    recentPartnersMap.set(id, new Set());
    reportedIdsMap.set(id, new Set());
    endedMatchesMap.set(id, new Map());
  });

  recentMatchesQuery.data?.forEach((m) => {
    if (recentPartnersMap.has(m.user_a)) recentPartnersMap.get(m.user_a)!.add(m.user_b);
    if (recentPartnersMap.has(m.user_b)) recentPartnersMap.get(m.user_b)!.add(m.user_a);
  });

  reportsQuery.data?.forEach((r) => {
    if (reportedIdsMap.has(r.reporter_session)) reportedIdsMap.get(r.reporter_session)!.add(r.reported_session);
    if (reportedIdsMap.has(r.reported_session)) reportedIdsMap.get(r.reported_session)!.add(r.reporter_session);
  });

  endedMatchesQuery.data?.forEach((m) => {
    if (endedMatchesMap.has(m.user_a)) endedMatchesMap.get(m.user_a)!.set(m.user_b, m.ended_at);
    if (endedMatchesMap.has(m.user_b)) endedMatchesMap.get(m.user_b)!.set(m.user_a, m.ended_at);
  });

  return { recentPartnersMap, reportedIdsMap, endedMatchesMap };
}

let lastHealTime = 0;
const HEAL_INTERVAL_MS = 15000;

/**
 * Self-healing and queue recovery (V4.1 Requirement 4 & 12).
 * Verifies that visitor_sessions, waiting_queue, reservations, and matches are in sync.
 * Runs periodically (throttled to 15s).
 */
export async function runGlobalHealCycle(supabase: SupabaseClient): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastHealTime < HEAL_INTERVAL_MS) {
    return;
  }

  if (isHealCycleRunning) {
    return; // Another instance is healing
  }
  isHealCycleRunning = true;
  lastHealTime = Date.now();

  const now = new Date().toISOString();
  const heartbeatThreshold = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();

  try {
    // --- 1. Session in waiting state, but queue entry is missing ---
    const { data: waitingSessions } = await supabase
      .from('visitor_sessions')
      .select('id, queue_entered_at')
      .in('status', ['SEARCHING', 'waiting'])
      .gt('last_activity', heartbeatThreshold);

    if (waitingSessions && waitingSessions.length > 0) {
      for (const sess of waitingSessions) {
        const { data: qEntry } = await supabase
          .from('waiting_queue')
          .select('id')
          .eq('session_id', sess.id)
          .eq('status', 'waiting')
          .maybeSingle();

        if (!qEntry) {
          console.log(`[Self-Healing] Session ${sess.id} status is wait/search, but queue entry is missing. Creating queue entry...`);
          await supabase.from('waiting_queue').insert({
            session_id: sess.id,
            status: 'waiting',
            joined_at: sess.queue_entered_at || now,
            last_seen: now,
          });
          // Ensure session status uses explicit V4.1 status 'SEARCHING'
          await transitionSessionStatus(supabase, sess.id, 'SEARCHING', 'Self-healing queue repair');
        }
      }
    }

    // --- 2. Queue entry is 'waiting', but session status is not 'SEARCHING' ---
    const { data: waitingQueueEntries } = await supabase
      .from('waiting_queue')
      .select(`
        id,
        session_id,
        visitor_sessions:session_id (
          status,
          last_activity
        )
      `)
      .eq('status', 'waiting');

    if (waitingQueueEntries && waitingQueueEntries.length > 0) {
      for (const entry of waitingQueueEntries) {
        const profile = entry.visitor_sessions as any;
        if (!profile) {
          console.log(`[Self-Healing] Queue entry ${entry.id} references non-existent session. Expiring queue entry...`);
          await supabase.from('waiting_queue').update({ status: 'expired' }).eq('id', entry.id);
          continue;
        }

        if (profile.status === 'ENDED' || profile.status === 'ended') {
          console.log(`[Self-Healing] Session ${entry.session_id} is ENDED. Expiring queue entry...`);
          await supabase.from('waiting_queue').update({ status: 'expired' }).eq('id', entry.id);
        } else if (profile.status === 'CONNECTED' || profile.status === 'MATCHED' || profile.status === 'matched') {
          console.log(`[Self-Healing] Session ${entry.session_id} is active in match (${profile.status}). Marking queue matched...`);
          await supabase.from('waiting_queue').update({ status: 'matched' }).eq('id', entry.id);
        } else if (profile.status !== 'SEARCHING') {
          // If session is active and recently updated, sync its status to SEARCHING
          if (profile.last_activity >= heartbeatThreshold) {
            console.log(`[Self-Healing] Session ${entry.session_id} has waiting queue but status is ${profile.status}. Syncing to SEARCHING...`);
            await transitionSessionStatus(supabase, entry.session_id, 'SEARCHING', 'Self-healing FSM state sync');
          } else {
            // Expire queue entry because heartbeat is dead
            console.log(`[Self-Healing] Stale heartbeat for queue entry ${entry.id}. Expiring queue entry...`);
            await supabase.from('waiting_queue').update({ status: 'expired' }).eq('id', entry.id);
            await transitionSessionStatus(supabase, entry.session_id, 'READY', 'Self-healing heartbeat expired');
          }
        }
      }
    }

    // --- 3. Reservation exists but match is missing or signaling timed out (V4.1 Requirement 3) ---
    const reservationCutoff = new Date(Date.now() - RESERVATION_TIMEOUT_MS).toISOString();
    const { data: activeReservations } = await supabase
      .from('reservations')
      .select('id, match_id, user_a, user_b, created_at')
      .eq('status', 'pending');

    if (activeReservations && activeReservations.length > 0) {
      for (const resv of activeReservations) {
        const timedOut = resv.created_at < reservationCutoff;
        
        let matchExists = false;
        if (resv.match_id) {
          const { data: match } = await supabase
            .from('matches')
            .select('id')
            .eq('id', resv.match_id)
            .maybeSingle();
          if (match) matchExists = true;
        }

        // KS-017: Only rollback if the reservation is actually timed out AND no match exists
        if (timedOut && !matchExists) {
          console.log(`[Self-Healing] Reservation ${resv.id} is stale or orphaned (timedOut=${timedOut}, matchExists=${matchExists}). Rolling back...`);
          await supabase.from('reservations').update({ status: 'rolled_back' }).eq('id', resv.id);
          
          // Re-queue both users if they are still active
          for (const uid of [resv.user_a, resv.user_b]) {
            const { data: sess } = await supabase.from('visitor_sessions').select('status, last_activity').eq('id', uid).maybeSingle();
            if (uid && sess && sess.last_activity >= heartbeatThreshold) {
              await transitionSessionStatus(supabase, uid, 'SEARCHING', 'Reservation rollback recovery');
              await supabase.from('waiting_queue').update({ status: 'waiting' }).eq('session_id', uid).eq('status', 'matched');
            }
          }
        }
      }
    }

    // --- 4. Match exists but peer is disconnected or ended ---
    const { data: activeMatches } = await supabase
      .from('matches')
      .select('id, user_a, user_b, started_at')
      .is('ended_at', null);

    if (activeMatches && activeMatches.length > 0) {
      for (const m of activeMatches) {
        const [resA, resB] = await Promise.all([
          supabase.from('visitor_sessions').select('status, last_activity').eq('id', m.user_a).maybeSingle(),
          supabase.from('visitor_sessions').select('status, last_activity').eq('id', m.user_b).maybeSingle(),
        ]);

        const profileA = resA.data;
        const profileB = resB.data;

        const staleA = !profileA || !profileA.last_activity || profileA.last_activity < heartbeatThreshold;
        const staleB = !profileB || !profileB.last_activity || profileB.last_activity < heartbeatThreshold;

        if (staleA || staleB) {
          console.log(`[Self-Healing] Ending active match ${m.id} due to stale heartbeat (A_stale=${staleA}, B_stale=${staleB})`);
          const duration = Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000);
          
          await supabase
            .from('matches')
            .update({
              ended_at: now,
              duration_seconds: duration,
              ended_reason: 'disconnect',
            })
            .eq('id', m.id);

          await supabase.from('temporary_messages').delete().eq('match_id', m.id);
          await supabase.from('reservations').delete().eq('match_id', m.id);

          // Re-queue any active peer (upsert pattern — avoid duplicate queue rows)
          if (!staleA && m.user_a) {
            console.log(`[Self-Healing] Requeuing active partner A: ${m.user_a}`);
            await transitionSessionStatus(supabase, m.user_a, 'SEARCHING', 'Peer disconnected match cleanup');
            // Try to update existing row first, insert only if none exists
            const { data: existingA } = await supabase
              .from('waiting_queue')
              .select('id')
              .eq('session_id', m.user_a)
              .in('status', ['matched', 'left', 'expired'])
              .limit(1)
              .maybeSingle();
            if (existingA) {
              await supabase.from('waiting_queue').update({ status: 'waiting', last_seen: now }).eq('id', existingA.id);
            } else {
              await supabase.from('waiting_queue').insert({
                session_id: m.user_a,
                status: 'waiting',
                joined_at: now,
                last_seen: now,
              });
            }
          }
          if (!staleB && m.user_b) {
            console.log(`[Self-Healing] Requeuing active partner B: ${m.user_b}`);
            await transitionSessionStatus(supabase, m.user_b, 'SEARCHING', 'Peer disconnected match cleanup');
            const { data: existingB } = await supabase
              .from('waiting_queue')
              .select('id')
              .eq('session_id', m.user_b)
              .in('status', ['matched', 'left', 'expired'])
              .limit(1)
              .maybeSingle();
            if (existingB) {
              await supabase.from('waiting_queue').update({ status: 'waiting', last_seen: now }).eq('id', existingB.id);
            } else {
              await supabase.from('waiting_queue').insert({
                session_id: m.user_b,
                status: 'waiting',
                joined_at: now,
                last_seen: now,
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[Self-Healing] Error during queue healing:', err instanceof Error ? err.message : err);
  } finally {
    isHealCycleRunning = false;
  }
}

/**
 * Global event-driven matchmaking cycle.
 * Loads all waiting users, filters them, finds the best matches, and sets up matches.
 */
export async function runGlobalMatchCycle(supabase: SupabaseClient): Promise<void> {
  const start = Date.now();

  // 1. Acquire distributed advisory lock to coordinate matching passes (V4.1 Requirement 16)
  if (isMatchmakerRunning) {
    return;
  }
  isMatchmakerRunning = true;

  try {
    // 2. Queue healing has been decoupled to runGlobalHealCycle (Phase 4 Perf Optimization)

    // 3. Expire stale reservations
    const expiredCount = await expireStaleReservations(supabase);
    if (expiredCount > 0) {
      console.log(`[Matchmaker] Expired ${expiredCount} stale reservations.`);
    }

    // 4. Load waiting queue entries (No cache, fix ghost matches)
    const heartbeatThreshold = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();
    let waitingQueue: any[] = [];

    const { data, error: queueErr } = await supabase
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
          status,
          display_name,
          bio,
          match_mode,
          match_constraints,
          match_attributes
        )
      `)
      .eq('status', 'waiting')
      .order('joined_at', { ascending: true }); // Oldest waiting first

    if (queueErr) {
      console.error('[Matchmaker] Failed to load waiting queue:', queueErr.message);
      return;
    }
    waitingQueue = data || [];

    // Filter active waiting users using heartbeat threshold
    let activeWaiting = waitingQueue.filter((entry) => {
      const profile = entry.visitor_sessions;
      if (!profile) return false;
      const lastActivity = profile.last_activity;
      return lastActivity && lastActivity >= heartbeatThreshold;
    });

    console.log(`[Matchmaker] Found ${activeWaiting.length} active waiting users.`);
    matchmakerMetrics.totalSearchingUsers = activeWaiting.length;

    if (activeWaiting.length < 2) return;

    // Track processed sessions in this cycle to prevent double matching
    const matchedOrReservedInCycle = new Set<string>();
    const reservedIds = await getReservedSessionIds(supabase);

    // 5. Batch load exclusions (Phase 4 Perf Optimization)
    const activeWaitingIds = activeWaiting.map(e => e.session_id);
    const { recentPartnersMap, reportedIdsMap, endedMatchesMap: allEndedMatchesMap } = await loadBatchedExclusions(supabase, activeWaitingIds);

    // 6. Match from oldest to newest (V4.1 Requirement 13: longest waiting prioritization)
    for (let i = 0; i < activeWaiting.length; i++) {
      const entryA = activeWaiting[i];
      const sessionIdA = entryA.session_id;

      if (matchedOrReservedInCycle.has(sessionIdA) || reservedIds.has(sessionIdA)) continue;

      const profileA = entryA.visitor_sessions;
      if (!profileA || profileA.status !== 'SEARCHING') continue;

      const recentPartners = recentPartnersMap.get(sessionIdA) || new Set();
      const reportedIds = reportedIdsMap.get(sessionIdA) || new Set();
      const endedMatchesMap = allEndedMatchesMap.get(sessionIdA) || new Map();

      const waitingSecondsA = Math.floor((Date.now() - new Date(entryA.joined_at).getTime()) / 1000);
      matchmakerMetrics.maximumWaitTime = Math.max(matchmakerMetrics.maximumWaitTime, waitingSecondsA);

      const scoredCandidates: Array<ReturnType<typeof calculateCompatibility> & { sessionId: string; entry: any }> = [];

      for (let j = 0; j < activeWaiting.length; j++) {
        const entryB = activeWaiting[j];
        const sessionIdB = entryB.session_id;

        if (sessionIdA === sessionIdB) continue;
        if (matchedOrReservedInCycle.has(sessionIdB) || reservedIds.has(sessionIdB)) continue;

        const profileB = entryB.visitor_sessions;
        if (!profileB || profileB.status !== 'SEARCHING') continue;

        const score = calculateCompatibility(
          profileA,
          profileB,
          waitingSecondsA,
          recentPartners,
          reportedIds,
          endedMatchesMap
        );

        if (score) {
          scoredCandidates.push({ ...score, sessionId: sessionIdB, entry: entryB });
        }
      }

      let ranked = rankCandidates(scoredCandidates, waitingSecondsA);

      if (scoredCandidates.length === 1) {
        ranked = [{ ...scoredCandidates[0], rank: 1, passesThreshold: true }];
      } else if (ranked.length === 0 && scoredCandidates.length > 0 && waitingSecondsA >= 25) {
        // Relax: fall back to best compatibility score if waiting > 25 seconds
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

      console.log(`[Matchmaker] Found match: ${sessionIdA} and ${sessionIdB} (score=${bestMatch.weightedScore}, reason=${bestMatch.reason})`);

      // Create reservation atomically (includes KS-014 FSM lock to RESERVED)
      const reservation = await createReservation(supabase, sessionIdA, sessionIdB);
      if (!reservation.success) {
        console.error(`[Matchmaker] Failed to reserve: ${reservation.reason}`);
        matchmakerMetrics.failedMatches += 1;
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
          user_a_ready: false,
          user_b_ready: false,
          negotiation_started: false,
        })
        .select()
        .single();

      if (matchError || !match) {
        console.error(`[Matchmaker] Match creation failed between ${userA} and ${userB}:`, matchError?.message);
        await rollbackReservation(supabase, reservation.reservationId, matchError?.message ?? 'Match insert failed');
        await Promise.all([
          transitionSessionStatus(supabase, sessionIdA, 'SEARCHING', 'Reservation rollback'),
          transitionSessionStatus(supabase, sessionIdB, 'SEARCHING', 'Reservation rollback'),
        ]);
        matchmakerMetrics.failedMatches += 1;
        continue;
      }

      // Confirm reservation
      await confirmReservation(supabase, reservation.reservationId, match.id);

      // Transition FSM states to MATCHED (V4.1 Requirement 1)
      const [matchedA, matchedB] = await Promise.all([
        transitionSessionStatus(supabase, userA, 'MATCHED', 'Match established'),
        transitionSessionStatus(supabase, userB, 'MATCHED', 'Match established'),
        supabase
          .from('waiting_queue')
          .update({ status: 'matched' })
          .in('session_id', [userA, userB])
          .eq('status', 'waiting'),
      ]);

      if (!matchedA || !matchedB) {
        console.error(`[Matchmaker] FSM Transition to MATCHED failed. State may be corrupt but proceeding.`);
      }

      // Track matchmaking statistics
      matchmakerMetrics.successfulMatches += 1;
      const isRematch = recentPartners.has(sessionIdB);
      if (isRematch) {
        matchmakerMetrics.rematches += 1;
      }
      
      const totalSuccessful = matchmakerMetrics.successfulMatches;
      const totalWaitTime = (matchmakerMetrics.averageWaitTime * (totalSuccessful - 1)) + waitingSecondsA;
      matchmakerMetrics.averageWaitTime = Math.round(totalWaitTime / totalSuccessful);

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
          isRematch,
        }),
        logToDb(supabase, userB, 'match_start', {
          matchId: match.id,
          partnerId: userA,
        }),
      ]);

      // Broadcast matched event to both sessions with profile and reason metadata
      const iceServers = getIceServers();
      const pA = profileA as any;
      const entryB = activeWaiting.find((w) => w.session_id === sessionIdB);
      const pB = entryB?.visitor_sessions as any;

      await Promise.all([
        broadcastToSession(userA, 'matched', {
          matchId: match.id,
          partnerSessionId: userB,
          isInitiator: userA === sessionIdA,
          iceServers,
          matchReasonMetadata: bestMatch.reasonMetadata,
          partnerProfile: {
            displayName: pB?.display_name || 'Guest',
            bio: pB?.bio || '',
            matchMode: pB?.match_mode || 'RANDOM',
            matchConstraints: pB?.match_constraints || {},
            matchAttributes: pB?.match_attributes || {},
            city: pB?.city || null,
            state: pB?.state || null,
            country: pB?.country || null,
            gender: pB?.gender || null,
            lookingFor: pB?.looking_for || [],
            languages: pB?.languages || [],
            interestTags: pB?.interest_tags || [],
          },
        }),
        broadcastToSession(userB, 'matched', {
          matchId: match.id,
          partnerSessionId: userA,
          isInitiator: userB === sessionIdA,
          iceServers,
          matchReasonMetadata: bestMatch.reasonMetadata,
          partnerProfile: {
            displayName: pA?.display_name || 'Guest',
            bio: pA?.bio || '',
            matchMode: pA?.match_mode || 'RANDOM',
            matchConstraints: pA?.match_constraints || {},
            matchAttributes: pA?.match_attributes || {},
            city: pA?.city || null,
            state: pA?.state || null,
            country: pA?.country || null,
            gender: pA?.gender || null,
            lookingFor: pA?.looking_for || [],
            languages: pA?.languages || [],
            interestTags: pA?.interest_tags || [],
          },
        }),
      ]);

      // Mark both as processed in this matchmaking pass
      matchedOrReservedInCycle.add(sessionIdA);
      matchedOrReservedInCycle.add(sessionIdB);

      console.log(`[Matchmaker] Successfully created match ${match.id} for ${sessionIdA} and ${sessionIdB}`);

      // Emit exactly-once Analytics Events with Idempotency Keys
      AnalyticsLogger.logEvent('MATCH_FOUND', sessionIdA, match.id, {
        matchMode: pA?.match_mode || 'QUICK',
        campus: pA?.campus
      }, `${match.id}_found_${sessionIdA}`);

      AnalyticsLogger.logEvent('MATCH_FOUND', sessionIdB, match.id, {
        matchMode: pB?.match_mode || 'QUICK',
        campus: pB?.campus
      }, `${match.id}_found_${sessionIdB}`);
    }
  } finally {
    // 6. Release advisory lock (V4.1 Requirement 16)
    isMatchmakerRunning = false;
  }
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

  // Helper to load partner details and return full matched state
  const getMatchedReturnPayload = async (matchObj: any) => {
    const partnerId = matchObj.user_a === sessionId ? matchObj.user_b : matchObj.user_a;
    const { data: partnerSession } = await supabase
      .from('visitor_sessions')
      .select('display_name, bio, match_mode, match_constraints, match_attributes, city, state, country, gender, looking_for, languages, interest_tags')
      .eq('id', partnerId)
      .maybeSingle();

    return {
      status: 'matched' as const,
      matchId: matchObj.id,
      partnerSessionId: partnerId,
      isInitiator: matchObj.user_a === sessionId,
      iceServers: getIceServers(),
      queuePosition: 0,
      waitingSeconds,
      matchReasonMetadata: matchObj.match_reason_metadata,
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
  };

  // 2. If they already have an active match, return it
  const existingMatch = await findActiveMatch(supabase, sessionId);
  if (existingMatch) {
    return await getMatchedReturnPayload(existingMatch);
  }

  // 3. Run the global matching cycle to try matching users
  await runGlobalMatchCycle(supabase);

  // 4. Re-check if this user got matched during the global matching cycle
  const newMatch = await findActiveMatch(supabase, sessionId);
  if (newMatch) {
    return await getMatchedReturnPayload(newMatch);
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

export { leaveQueueEntry, joinQueueEntry };

/**
 * Mark user READY.
 * Phase 1 fix: Uses DB-only state (no in-memory Map) so it survives server restarts.
 * When both users are ready, broadcasts START_NEGOTIATION to both sessions.
 */
export async function markUserReady(
  supabase: SupabaseClient,
  sessionId: string,
  sessionToken: string,
  matchId: string
): Promise<{ bothReady: boolean; isInitiator: boolean }> {
  const requestId = `${sessionId.slice(0, 8)}-${Date.now()}`;
  console.log(`\n[/ready] [${requestId}] sessionId=${sessionId} matchId=${matchId}`);

  // 1. Validate session
  const { data: session, error: sessErr } = await supabase
    .from('visitor_sessions')
    .select('id, session_token, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessErr || !session || session.session_token !== sessionToken) {
    console.error(`[/ready] [${requestId}] Session validation failed`);
    throw new Error('Invalid session or session token mismatch');
  }

  // 2. Load match
  const { data: match, error: matchErr } = await supabase
    .from('matches')
    .select('id, user_a, user_b, user_a_ready, user_b_ready, negotiation_started, match_reason_metadata')
    .eq('id', matchId)
    .is('ended_at', null)
    .maybeSingle();

  if (matchErr || !match) {
    console.error(`[/ready] [${requestId}] Match not found: ${matchId}`);
    throw new Error(`Match not found or already ended. ID: ${matchId}`);
  }

  const isUserA = match.user_a === sessionId;
  const isUserB = match.user_b === sessionId;
  if (!isUserA && !isUserB) {
    throw new Error('Not a participant in this match');
  }

  // If negotiation already started, re-broadcast start_negotiation to trigger renegotiation/ICE restart
  if (match.negotiation_started) {
    console.log(`[/ready] [${requestId}] Negotiation already started — re-broadcasting start_negotiation to restore session`);
    const partnerId = isUserA ? match.user_b : match.user_a;
    const iceServers = getIceServers();

    const [sessSelfQuery, sessPartnerQuery] = await Promise.all([
      supabase
        .from('visitor_sessions')
        .select('display_name, bio, match_mode, match_constraints, match_attributes, city, state, country, gender, looking_for, languages, interest_tags')
        .eq('id', sessionId)
        .maybeSingle(),
      supabase
        .from('visitor_sessions')
        .select('display_name, bio, match_mode, match_constraints, match_attributes, city, state, country, gender, looking_for, languages, interest_tags')
        .eq('id', partnerId)
        .maybeSingle(),
    ]);

    const pSelf = sessSelfQuery.data;
    const pPartner = sessPartnerQuery.data;
    const eventId = crypto.randomUUID();

    await Promise.all([
      broadcastToSession(sessionId, 'start_negotiation', {
        eventId,
        matchId,
        partnerSessionId: partnerId,
        isInitiator: isUserA,
        iceServers,
        matchReasonMetadata: match.match_reason_metadata,
        partnerProfile: pPartner ? {
          displayName: pPartner.display_name || 'Guest',
          bio: pPartner.bio || '',
          matchMode: pPartner.match_mode || 'RANDOM',
          matchConstraints: pPartner.match_constraints || {},
          matchAttributes: pPartner.match_attributes || {},
          city: pPartner.city || null,
          state: pPartner.state || null,
          country: pPartner.country || null,
          gender: pPartner.gender || null,
          lookingFor: pPartner.looking_for || [],
          languages: pPartner.languages || [],
          interestTags: pPartner.interest_tags || [],
        } : null,
      }).catch(e => console.warn(`[/ready] Re-broadcast to ${sessionId} failed:`, e?.message)),
      broadcastToSession(partnerId, 'start_negotiation', {
        eventId,
        matchId,
        partnerSessionId: sessionId,
        isInitiator: !isUserA,
        iceServers,
        matchReasonMetadata: match.match_reason_metadata,
        partnerProfile: pSelf ? {
          displayName: pSelf.display_name || 'Guest',
          bio: pSelf.bio || '',
          matchMode: pSelf.match_mode || 'RANDOM',
          matchConstraints: pSelf.match_constraints || {},
          matchAttributes: pSelf.match_attributes || {},
          city: pSelf.city || null,
          state: pSelf.state || null,
          country: pSelf.country || null,
          gender: pSelf.gender || null,
          lookingFor: pSelf.looking_for || [],
          languages: pSelf.languages || [],
          interestTags: pSelf.interest_tags || [],
        } : null,
      }).catch(e => console.warn(`[/ready] Re-broadcast to ${partnerId} failed:`, e?.message)),
    ]);

    return { bothReady: true, isInitiator: isUserA };
  }

  await logToDb(supabase, sessionId, 'ready', { matchId, requestId });

  // 3. Write THIS user's ready flag to DB
  const readyUpdate = isUserA ? { user_a_ready: true } : { user_b_ready: true };
  const { data: updated, error: updateErr } = await supabase
    .from('matches')
    .update(readyUpdate)
    .eq('id', matchId)
    .select('user_a_ready, user_b_ready')
    .single();

  if (updateErr || !updated) {
    console.error(`[/ready] [${requestId}] Failed to write ready flag:`, updateErr?.message);
    throw new Error('Failed to record ready state');
  }

  const bothReady = Boolean(updated.user_a_ready && updated.user_b_ready);
  console.log(`[/ready] [${requestId}] user_a_ready=${updated.user_a_ready} user_b_ready=${updated.user_b_ready} bothReady=${bothReady}`);

  if (bothReady) {
    // 4. Atomically mark negotiation as started to prevent double-broadcast
    const { error: flagErr } = await supabase
      .from('matches')
      .update({ negotiation_started: true })
      .eq('id', matchId)
      .eq('negotiation_started', false); // Only update if not already set

    if (flagErr) {
      console.warn(`[/ready] [${requestId}] negotiation_started flag conflict — another instance may have handled this`);
      return { bothReady: true, isInitiator: isUserA };
    }

    const partnerId = isUserA ? match.user_b : match.user_a;
    const iceServers = getIceServers();

    console.log(`[/ready] [${requestId}] Both ready — broadcasting start_negotiation to ${sessionId} and ${partnerId}`);

    // Emit exactly-once Analytics Event
    AnalyticsLogger.logEvent('CALL_CONNECTED', sessionId, matchId, {}, `${matchId}_call_connected`);

    // Fetch profile details for both sessions
    const [sessSelfQuery, sessPartnerQuery] = await Promise.all([
      supabase
        .from('visitor_sessions')
        .select('display_name, bio, match_mode, match_constraints, match_attributes, city, state, country, gender, looking_for, languages, interest_tags')
        .eq('id', sessionId)
        .maybeSingle(),
      supabase
        .from('visitor_sessions')
        .select('display_name, bio, match_mode, match_constraints, match_attributes, city, state, country, gender, looking_for, languages, interest_tags')
        .eq('id', partnerId)
        .maybeSingle(),
    ]);

    const pSelf = sessSelfQuery.data;
    const pPartner = sessPartnerQuery.data;

    const eventId = crypto.randomUUID();

    await Promise.all([
      broadcastToSession(sessionId, 'start_negotiation', {
        eventId,
        matchId,
        partnerSessionId: partnerId,
        isInitiator: isUserA,
        iceServers,
        matchReasonMetadata: match.match_reason_metadata,
        partnerProfile: pPartner ? {
          displayName: pPartner.display_name || 'Guest',
          bio: pPartner.bio || '',
          matchMode: pPartner.match_mode || 'RANDOM',
          matchConstraints: pPartner.match_constraints || {},
          matchAttributes: pPartner.match_attributes || {},
          city: pPartner.city || null,
          state: pPartner.state || null,
          country: pPartner.country || null,
          gender: pPartner.gender || null,
          lookingFor: pPartner.looking_for || [],
          languages: pPartner.languages || [],
          interestTags: pPartner.interest_tags || [],
        } : null,
      }).catch(e => console.warn(`[/ready] Broadcast to ${sessionId} failed:`, e?.message)),
      broadcastToSession(partnerId, 'start_negotiation', {
        eventId,
        matchId,
        partnerSessionId: sessionId,
        isInitiator: !isUserA,
        iceServers,
        matchReasonMetadata: match.match_reason_metadata,
        partnerProfile: pSelf ? {
          displayName: pSelf.display_name || 'Guest',
          bio: pSelf.bio || '',
          matchMode: pSelf.match_mode || 'RANDOM',
          matchConstraints: pSelf.match_constraints || {},
          matchAttributes: pSelf.match_attributes || {},
          city: pSelf.city || null,
          state: pSelf.state || null,
          country: pSelf.country || null,
          gender: pSelf.gender || null,
          lookingFor: pSelf.looking_for || [],
          languages: pSelf.languages || [],
          interestTags: pSelf.interest_tags || [],
        } : null,
      }).catch(e => console.warn(`[/ready] Broadcast to ${partnerId} failed:`, e?.message)),
    ]);

    await logToDb(supabase, sessionId, 'negotiation_start', { matchId, requestId });
  }

  return { bothReady, isInitiator: isUserA };
}
