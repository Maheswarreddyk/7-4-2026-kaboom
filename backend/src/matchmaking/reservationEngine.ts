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
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        // 005 column names (user's actual DB)
        user_a: initiatorSessionId,
        user_b: partnerSessionId,
        // 006 alias column names (code compatibility layer)
        initiator_session_id: initiatorSessionId,
        partner_session_id: partnerSessionId,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (error) {
      // If table doesn't exist yet (pre-005 deployment), proceed without reservation
      if (error.message.includes('schema cache') || error.code === '42P01') {
        console.warn('[ReservationEngine] Reservations table not yet migrated — proceeding without lock.');
        return { reservationId: '', success: true, reason: 'Reservations table not migrated' };
      }
      // Unique constraint violation = one of these sessions is already reserved
      if (error.code === '23505') {
        console.warn(`[ReservationEngine] Reservation conflict for ${initiatorSessionId} or ${partnerSessionId}`);
        return { reservationId: '', success: false, reason: 'Session already reserved' };
      }
      logEngine({
        engine: 'ReservationEngine',
        sessionId: initiatorSessionId,
        success: false,
        reason: error.message,
        durationMs: Date.now() - start,
      });
      return { reservationId: '', success: false, reason: error.message };
    }

    await logToDb(supabase, initiatorSessionId, 'reservation_created', {
      reservationId: data.id,
      partnerSessionId,
      expiresAt,
    });

    console.log(`[ReservationEngine] Reserved pair ${initiatorSessionId} <-> ${partnerSessionId} (expires ${expiresAt})`);
    return { reservationId: data.id, success: true, reason: 'Reserved' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reservation unavailable';
    console.warn(`[ReservationEngine] Non-fatal reservation error: ${message}`);
    return { reservationId: '', success: true, reason: `Skipped reservation: ${message}` };
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
