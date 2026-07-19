import { getSupabase } from '../database/client.js';

/**
 * Broadcast an event to a specific session via Supabase Realtime.
 * Uses fire-and-forget channel.send() because the server only sends, it does not need to subscribe.
 */
export async function broadcastToSession(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const start = Date.now();
  const supabase = getSupabase();
  const channelName = `session:${sessionId}`;
  
  // Create channel instance
  const channel = supabase.channel(channelName);

  try {
    // Send without subscribing (server doesn't need to receive)
    const resp = await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
    
    const latencyMs = Date.now() - start;
    if (resp !== 'ok') {
      console.error(`[Broadcast] Failed to send '${event}' to ${channelName}: ${resp}`);
    } else {
      console.log(`[Broadcast] event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs}`);
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error(`[Broadcast] Error sending event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs} error=${err instanceof Error ? err.message : err}`);
  } finally {
    // Always clean up the channel reference to prevent memory leaks
    try {
      supabase.removeChannel(channel);
    } catch {}
  }
}
