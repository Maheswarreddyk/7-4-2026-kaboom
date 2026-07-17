import type { SupabaseClient } from '@supabase/supabase-js';
import { RESERVATION_TIMEOUT_MS } from './config.js';
import { logEngine, logToDb } from './logger.js';

export interface ReservationResult {
  reservationId: string;
  success: boolean;
  reason: string;
}

/**
 * Creates an atomic reservation lock for a pair of sessions before inserting a match row.
 * Writes both (user_a/user_b) and (initiator_session_id/partner_session_id) to be compatible
 * with both the 005 and 006 migrations.
 */
export async function createReservation(
  supabase: SupabaseClient,
  initiatorSessionId: string,
  partnerSessionId: string
): Promise<ReservationResult> {
  const start = Date.now();
  const expiresAt = new Date(Date.now() + RESERVATION_TIMEOUT_MS).toISOString();

  try {
    const { data, error } = await supabase.rpc('matchmaker_create_reservation', {
      p_initiator_id: initiatorSessionId,
      p_partner_id: partnerSessionId,
      p_expires_at: expiresAt,
    });

    if (error) {
      logEngine({
        engine: 'ReservationEngine',
        sessionId: initiatorSessionId,
        success: false,
        reason: error.message,
        durationMs: Date.now() - start,
      });
      return { reservationId: '', success: false, reason: error.message };
    }

    if (!data.success) {
      console.warn(`[ReservationEngine] Reservation failed: ${data.reason}`);
      return { reservationId: '', success: false, reason: data.reason };
    }

    await logToDb(supabase, initiatorSessionId, 'reservation_created', {
      reservationId: data.reservationId,
      partnerSessionId,
      expiresAt,
    });

    console.log(`[ReservationEngine] Reserved pair ${initiatorSessionId} <-> ${partnerSessionId} (expires ${expiresAt})`);
    return { reservationId: data.reservationId, success: true, reason: 'Reserved' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reservation unavailable';
    console.warn(`[ReservationEngine] Non-fatal reservation error: ${message}`);
    return { reservationId: '', success: false, reason: `Skipped reservation: ${message}` };
  }
}

export async function confirmReservation(
  supabase: SupabaseClient,
  reservationId: string,
  matchId: string
): Promise<void> {
  if (!reservationId) return;
  try {
    await supabase
      .from('reservations')
      .update({ status: 'confirmed', match_id: matchId })
      .eq('id', reservationId);
    await logToDb(supabase, null, 'reservation_confirmed', { reservationId, matchId });
  } catch {
    // reservations table optional until migration applied
  }
}

export async function rollbackReservation(
  supabase: SupabaseClient,
  reservationId: string,
  reason: string
): Promise<void> {
  if (!reservationId) return;
  try {
    await supabase.from('reservations').update({ status: 'rolled_back' }).eq('id', reservationId);
  } catch {
    // best-effort
  }
  logEngine({
    engine: 'ReservationEngine',
    reservationId,
    success: false,
    reason: `Rollback: ${reason}`,
  });
}
