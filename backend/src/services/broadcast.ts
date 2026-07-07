import { getSupabase } from '../database/client.js';

/** Timeout for Supabase Realtime channel subscription before we give up (ms) */
const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 8_000;

/**
 * Broadcast an event to a specific session via Supabase Realtime.
 * Creates a transient channel, subscribes, sends the event, then removes the channel.
 *
 * Phase 1 fix: Increased timeout from 5000ms to 8000ms.
 * Phase 1 fix: Added structured logging (sessionId, event, latency, outcome).
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
    console.log(`[Broadcast] event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs}`);
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error(`[Broadcast] FAILED event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs} error=${err instanceof Error ? err.message : err}`);
    throw err;
  } finally {
    try {
      await supabase.removeChannel(channel);
    } catch {
      // best-effort channel cleanup
    }
  }
}
