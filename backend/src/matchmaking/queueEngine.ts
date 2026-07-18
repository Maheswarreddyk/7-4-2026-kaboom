import type { SupabaseClient } from '@supabase/supabase-js';
import { HEARTBEAT_STALE_MS } from './config.js';
import { logEngine, logToDb } from './logger.js';
import { AnalyticsLogger } from '../analytics/logger.js';
import { transitionSessionStatus, matchmakerMetrics } from './matchingEngine.js';

export interface JoinQueueResult {
  queueId: string;
  joinedAt: string;
  lastSeen: string;
  isNewEntry: boolean;
  waitingSeconds: number;
}

/**
 * Idempotent queue join: preserve joined_at; heartbeat updates last_activity only.
 */
export async function joinQueueEntry(
  supabase: SupabaseClient,
  sessionId: string
): Promise<JoinQueueResult> {
  const start = Date.now();
  const now = new Date().toISOString();

  const { data: session, error: sessionErr } = await supabase
    .from('visitor_sessions')
    .select('id, queue_entered_at, status')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionErr || !session) {
    logEngine({
      engine: 'QueueEngine',
      sessionId,
      success: false,
      reason: 'Session not found',
      durationMs: Date.now() - start,
    });
    throw new Error('Session not found');
  }

  // Check if already in queue first so we can determine queueEnteredAt correctly
  const { data: existing, error: existingErr } = await supabase
    .from('waiting_queue')
    .select('id, joined_at')
    .eq('session_id', sessionId)
    .in('status', ['waiting', 'matched'])
    .maybeSingle();

  if (existingErr) throw existingErr;

  let queueEnteredAt = now;
  if (existing) {
    queueEnteredAt = existing.joined_at;
  }

  // MT4 Fix: Use transitionSessionStatus to enforce FSM Guard
  const fsmSuccess = await transitionSessionStatus(supabase, sessionId, 'SEARCHING', 'join_queue', session.status);
  if (!fsmSuccess && session.status !== 'SEARCHING') {
    throw new Error('Illegal state transition to SEARCHING');
  }

  // MT1 Fix: Forcefully update queue_entered_at to NOW() on new entry, or preserve if existing
  // Also update last_activity to prevent the session from being marked stale by the cleanup job
  await supabase
    .from('visitor_sessions')
    .update({ queue_entered_at: queueEnteredAt, last_activity: now })
    .eq('id', sessionId);

  if (existing) {
    const waitingSeconds = Math.floor(
      (Date.now() - new Date(queueEnteredAt).getTime()) / 1000
    );

    // Update last_seen heartbeat and revert status to waiting on existing entry
    await supabase
      .from('waiting_queue')
      .update({ status: 'waiting', last_seen: now })
      .eq('id', existing.id);

    logEngine({
      engine: 'QueueEngine',
      sessionId,
      queueId: existing.id,
      success: true,
      reason: 'Heartbeat updated (joined_at preserved)',
      durationMs: Date.now() - start,
      details: { joinedAt: existing.joined_at, lastSeen: now, waitingSeconds },
    });

    return {
      queueId: existing.id,
      joinedAt: existing.joined_at,
      lastSeen: now,
      isNewEntry: false,
      waitingSeconds,
    };
  }

  // Count current queue position
  const { count } = await supabase
    .from('waiting_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'waiting');

  const queuePosition = (count ?? 0) + 1;

  const { data: inserted, error: insertErr } = await supabase
    .from('waiting_queue')
    .insert({
      session_id: sessionId,
      status: 'waiting',
      joined_at: queueEnteredAt,
      last_seen: now,
    })
    .select('id, joined_at')
    .single();

  if (insertErr || !inserted) throw insertErr ?? new Error('Failed to insert queue entry');

  await logToDb(supabase, sessionId, 'queue_join', { queueId: inserted.id, queuePosition });

  AnalyticsLogger.logEvent('QUEUE_JOINED', sessionId, undefined, {
    queuePosition,
    campus: 'Unknown', // In a full implementation, we would look up their campus here from visitor_sessions
  }, `${inserted.id}_joined`);

  const waitingSeconds = Math.floor(
    (Date.now() - new Date(queueEnteredAt).getTime()) / 1000
  );

  logEngine({
    engine: 'QueueEngine',
    sessionId,
    queueId: inserted.id,
    success: true,
    reason: 'New queue entry created',
    durationMs: Date.now() - start,
    details: { joinedAt: inserted.joined_at, queuePosition, waitingSeconds },
  });

  return {
    queueId: inserted.id,
    joinedAt: inserted.joined_at,
    lastSeen: now,
    isNewEntry: true,
    waitingSeconds,
  };
}

export async function leaveQueueEntry(supabase: SupabaseClient, sessionId: string): Promise<void> {
  matchmakerMetrics.abandonedSearches++;

  await supabase
    .from('waiting_queue')
    .update({ status: 'left' })
    .eq('session_id', sessionId)
    .in('status', ['waiting', 'matched']);

  // BE-002: Enforce FSM validation
  const success = await transitionSessionStatus(supabase, sessionId, 'READY', 'leave_queue', 'SEARCHING');
  if (!success) {
    throw new Error('Illegal state transition: User must be SEARCHING to leave queue');
  }

  await supabase
    .from('visitor_sessions')
    .update({ queue_entered_at: null })
    .eq('id', sessionId);

  await logToDb(supabase, sessionId, 'queue_leave', {});
}

export async function loadWaitingCandidates(
  supabase: SupabaseClient,
  sessionId: string
): Promise<
  Array<{
    session_id: string;
    joined_at: string;
    visitor_sessions: Record<string, unknown>;
  }>
> {
  const heartbeatThreshold = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();

  const { data, error } = await supabase
    .from('waiting_queue')
    .select(`
      session_id,
      joined_at,
      visitor_sessions:session_id (
        id,
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
    .neq('session_id', sessionId);

  if (error) throw error;

  const rows = (data ?? []) as unknown as Array<{
    session_id: string;
    joined_at: string;
    visitor_sessions: Record<string, unknown> & { last_activity?: string };
  }>;

  return rows.filter((row) => {
    const profile = row.visitor_sessions;
    const lastActivity = profile?.last_activity as string | undefined;
    return lastActivity ? lastActivity >= heartbeatThreshold : row.joined_at >= heartbeatThreshold;
  });
}

/**
 * Load reserved session IDs from the reservations table.
 * Reads both column variants (user_a/user_b from 005, initiator/partner from 006).
 */
export async function getReservedSessionIds(supabase: SupabaseClient): Promise<Set<string>> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('reservations')
      .select('initiator_session_id, partner_session_id')
      .eq('status', 'pending')
      .gt('expires_at', now);

    if (error) return new Set();
    const ids = new Set<string>();
    data?.forEach((r) => {
      if (r.initiator_session_id) ids.add(r.initiator_session_id);
      if (r.partner_session_id) ids.add(r.partner_session_id);
    });
    return ids;
  } catch {
    return new Set();
  }
}

/**
 * Expire reservations that have passed their TTL and return affected sessions to the queue.
 */
export async function expireStaleReservations(supabase: SupabaseClient): Promise<number> {
  try {
    const now = new Date().toISOString();
    const { data: expired } = await supabase
      .from('reservations')
      .select('id, initiator_session_id, partner_session_id')
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (!expired?.length) return 0;

    for (const r of expired) {
      await supabase.from('reservations').update({ status: 'expired' }).eq('id', r.id);

      // Collect affected session IDs from either column set
      const sessionIds = Array.from(new Set([
        r.initiator_session_id,
        r.partner_session_id,
      ].filter(Boolean)));

      if (sessionIds.length) {
        await supabase
          .from('waiting_queue')
          .update({ status: 'waiting' })
          .in('session_id', sessionIds)
          .eq('status', 'matched');

        await supabase
          .from('visitor_sessions')
          .update({ status: 'SEARCHING' })
          .in('id', sessionIds);
      }

      console.log(`[QueueEngine] Expired stale reservation ${r.id} — returned ${sessionIds.length} sessions to queue`);
    }
    return expired.length;
  } catch {
    return 0;
  }
}
