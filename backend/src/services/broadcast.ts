import { getEnv } from '../context.js';

/**
 * Broadcast an event to a specific session via Supabase Realtime REST API.
 * Uses HTTP POST to avoid WebSocket churn and silent failures in Cloudflare Workers.
 */
export async function broadcastToSession(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const start = Date.now();
  const env = getEnv();
  const url = (env.SUPABASE_URL as string) || '';
  const key = (env.SUPABASE_SERVICE_ROLE_KEY as string) || '';
  
  const channelName = `session:${sessionId}`;

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        messages: [{
          topic: channelName,
          event: event,
          payload: payload
        }]
      })
    });
    
    const latencyMs = Date.now() - start;
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Broadcast] Failed to send '${event}' to ${channelName}: ${response.status} ${errorText}`);
    } else {
      console.log(`[Broadcast] event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs}`);
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error(`[Broadcast] Error sending event=${event} sessionId=${sessionId.slice(0, 8)} latencyMs=${latencyMs} error=${err instanceof Error ? err.message : err}`);
  }
}
