import { getSupabase } from '../database/client.js';

/** Timeout for Supabase Realtime channel subscription before we give up (ms) */
const BROADCAST_SUBSCRIBE_TIMEOUT_MS = 8_000;

// LRU Cache for Realtime Channels (Phase 4 fix)
const MAX_CHANNELS = 100;
interface CachedChannel {
  channel: any;
  readyPromise: Promise<void>;
  lastUsed: number;
}
const channelPool = new Map<string, CachedChannel>();

function evictOldestChannel() {
  if (channelPool.size === 0) return;
  let oldestSessionId = '';
  let oldestTime = Infinity;
  for (const [sid, cc] of channelPool.entries()) {
    if (cc.lastUsed < oldestTime) {
      oldestTime = cc.lastUsed;
      oldestSessionId = sid;
    }
  }
  if (oldestSessionId) {
    const cc = channelPool.get(oldestSessionId);
    if (cc) {
      try {
        getSupabase().removeChannel(cc.channel);
      } catch { /* best effort */ }
      channelPool.delete(oldestSessionId);
    }
  }
}

/**
 * Broadcast an event to a specific session via Supabase Realtime.
 * Uses an LRU connection pool to avoid creating new channels per event.
 */
export async function broadcastToSession(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const start = Date.now();
  const supabase = getSupabase();

  let cached = channelPool.get(sessionId);

  if (!cached) {
    if (channelPool.size >= MAX_CHANNELS) {
      evictOldestChannel();
    }
    
    const channel = supabase.channel(`session:${sessionId}`, {
      config: { broadcast: { ack: false, self: false } },
    });

    const readyPromise = new Promise<void>((resolve, reject) => {
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

    cached = { channel, readyPromise, lastUsed: Date.now() };
    channelPool.set(sessionId, cached);
  } else {
    cached.lastUsed = Date.now();
    // Update Map iteration order for LRU
    channelPool.delete(sessionId);
    channelPool.set(sessionId, cached);
  }

  try {
    await cached.readyPromise;
    await cached.channel.send({ type: 'broadcast', event, payload });

    const latencyMs = Date.now() - start;
    console.log(`[Broadcast] event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs} (pooled)`);
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error(`[Broadcast] FAILED event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs} error=${err instanceof Error ? err.message : err}`);
    // If it fails, evict it so we try fresh next time
    channelPool.delete(sessionId);
    try { supabase.removeChannel(cached.channel); } catch {}
    throw err;
  }
}
