import type { SupabaseClient } from '@supabase/supabase-js';
import { HEARTBEAT_STALE_MS } from './config.js';
import { logEngine, logToDb } from './logger.js';

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

  let queueEnteredAt = session.queue_entered_at as string | null;
  if (!queueEnteredAt) {
    queueEnteredAt = now;
  }

  await supabase
    .from('visitor_sessions')
    .update({
      queue_entered_at: queueEnteredAt,
      last_activity: now,
      status: 'waiting',
    })
    .eq('id', sessionId);

  const { data: existing, error: existingErr } = await supabase
    .from('waiting_queue')
    .select('id, joined_at')
    .eq('session_id', sessionId)
    .eq('status', 'waiting')
    .maybeSingle();

  if (existingErr) throw existingErr;

  if (existing) {
    const waitingSeconds = Math.floor(
      (Date.now() - new Date(queueEnteredAt).getTime()) / 1000
    );

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

  const { count } = await supabase
    .from('waiting_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'waiting');

  const queuePosition = (count ?? 0) + 1;

  const insertPayload: Record<string, unknown> = {
    session_id: sessionId,
    status: 'waiting',
    joined_at: queueEnteredAt,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('waiting_queue')
    .insert(insertPayload)
    .select('id, joined_at')
    .single();

  if (insertErr || !inserted) throw insertErr ?? new Error('Failed to insert queue entry');

  await logToDb(supabase, sessionId, 'queue_join', { queueId: inserted.id, queuePosition });

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
  await supabase
    .from('waiting_queue')
    .update({ status: 'left' })
    .eq('session_id', sessionId)
    .eq('status', 'waiting');

  await supabase
    .from('visitor_sessions')
    .update({ status: 'active' })
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
        status
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
      ids.add(r.initiator_session_id);
      ids.add(r.partner_session_id);
    });
    return ids;
  } catch {
    return new Set();
  }
}

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
      await supabase
        .from('waiting_queue')
        .update({ status: 'waiting' })
        .in('session_id', [r.initiator_session_id, r.partner_session_id])
        .eq('status', 'matched');
    }
    return expired.length;
  } catch {
    return 0;
  }
}
