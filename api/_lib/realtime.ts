import { getSupabase } from './supabase.js';

/** Timeout for Supabase Realtime channel subscription before we give up (ms) */
const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 8_000;

/**
 * Broadcast an event to a specific session via Supabase Realtime.
 * Creates a transient channel, subscribes, sends the event, then removes the channel.
 *
 * Phase 1C notes:
 * - Timeout increased from 5,000ms to 8,000ms to match backend broadcast.ts and reduce
 *   false timeout failures under Supabase load.
 * - Structured logging added: sessionId prefix, event name, latency, outcome.
 * - Channel removal moved to finally block so it always runs even if send fails.
 * - A module-level channel pool was NOT implemented here because Vercel serverless
 *   function instances are ephemeral — module-level state may reset between invocations,
 *   giving false reuse confidence. The backend (persistent Render process) is the correct
 *   location for a channel pool and already has one in its architecture plan.
 */
export async function broadcastToSession(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const start = Date.now();
  const supabase = getSupabase();
  const channel = supabase.channel(`session:${sessionId}`, {
    config: { broadcast: { ack: false, self: false } },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Realtime subscribe timeout after ${BROADCAST_SUBSCRIBE_TIMEOUT_MS}ms`));
      }, BROADCAST_SUBSCRIBE_TIMEOUT_MS);

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(new Error(`Realtime channel error: ${status}`));
        }
      });
    });

    await channel.send({ type: 'broadcast', event, payload });

    const latencyMs = Date.now() - start;
    console.log(`[Broadcast] event=${event} session=${sessionId.slice(0, 8)} latencyMs=${latencyMs}`);
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error(`[Broadcast] FAILED event=${event} session=${sessionId.slice(0, 8)} latencyMs=${latencyMs} error=${err instanceof Error ? err.message : err}`);
    throw err;
  } finally {
    try {
      await supabase.removeChannel(channel);
    } catch {
      // best-effort channel cleanup — do not propagate cleanup errors
    }
  }
}

