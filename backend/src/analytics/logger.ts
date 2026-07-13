import { getSupabase } from '../database/client.js';

/**
 * Analytics Event Types (must match DB enum)
 */
export type AnalyticsEventType = 
  | 'SESSION_STARTED'
  | 'SESSION_RESTORED'
  | 'QUEUE_JOINED'
  | 'QUEUE_LEFT'
  | 'QUEUE_TIMEOUT'
  | 'MATCH_FOUND'
  | 'MATCH_CANCELLED'
  | 'CALL_CONNECTED'
  | 'CALL_RECONNECTED'
  | 'CALL_FAILED'
  | 'CALL_ENDED'
  | 'MUTUAL_LIKE'
  | 'FILTER_SELECTED'
  | 'MATCH_MODE_SELECTED'
  | 'FEEDBACK_SUBMITTED'
  | 'REPORT_SUBMITTED';

interface AnalyticsPayload {
  [key: string]: string | number | boolean | null | undefined | object;
}

/**
 * AnalyticsLogger
 * 
 * Submits append-only events to the analytics_events table.
 * Operations are fire-and-forget and MUST NOT throw or block the main thread.
 * Fails silently if Supabase is down to protect the matchmaking engine.
 */
class AnalyticsLoggerService {
  /**
   * Fire-and-forget log method.
   * @param eventType The type of event to log.
   * @param sessionId Optional visitor session ID.
   * @param matchId Optional match ID.
   * @param payload Any JSON-serializable context.
   */
  public logEvent(
    eventType: AnalyticsEventType,
    sessionId?: string,
    matchId?: string,
    payload: AnalyticsPayload = {}
  ): void {
    // Detach from current execution context
    setTimeout(() => {
      this.asyncLog(eventType, sessionId, matchId, payload).catch((err) => {
        // Silently swallow analytics errors to protect production
        console.error(`[AnalyticsLogger] Failed to log ${eventType}:`, err.message);
      });
    }, 0);
  }

  private async asyncLog(
    eventType: AnalyticsEventType,
    sessionId?: string,
    matchId?: string,
    payload: AnalyticsPayload = {}
  ): Promise<void> {
    const supabase = getSupabase();
    
    // Explicitly stripping undefined to satisfy Supabase JSONB
    const cleanPayload = JSON.parse(JSON.stringify(payload));

    const { error } = await supabase.from('analytics_events').insert({
      event_type: eventType,
      session_id: sessionId || null,
      match_id: matchId || null,
      payload: cleanPayload,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export const AnalyticsLogger = new AnalyticsLoggerService();
