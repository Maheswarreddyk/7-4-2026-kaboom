import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { store } from './store';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_KEY);

export function startSupabaseWatcher() {
  console.log('[SupabaseWatcher] Starting database event listener...');

  // Watch visitor_sessions
  supabase
    .channel('sessions-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'visitor_sessions' }, (payload) => {
      const sessionId = payload.new?.id || payload.old?.id;
      if (sessionId) {
        const trail = store.getTrailBySessionId(sessionId);
        if (trail) {
          store.logAction(trail.userId, {
            timestamp: new Date().toISOString(),
            previousState: payload.old?.status || 'UNKNOWN',
            currentState: payload.new?.status || 'UNKNOWN',
            action: `DB:Session:${payload.eventType}`,
            result: JSON.stringify(payload.new || {}),
            durationMs: 0,
            success: true
          });
        }
      }
    })
    .subscribe();

  // Watch waiting_queue
  supabase
    .channel('queue-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'waiting_queue' }, (payload) => {
      const sessionId = payload.new?.session_id || payload.old?.session_id;
      if (sessionId) {
        const trail = store.getTrailBySessionId(sessionId);
        if (trail) {
          store.logAction(trail.userId, {
            timestamp: new Date().toISOString(),
            previousState: payload.old?.status || 'UNKNOWN',
            currentState: payload.new?.status || 'UNKNOWN',
            action: `DB:Queue:${payload.eventType}`,
            result: JSON.stringify(payload.new || {}),
            durationMs: 0,
            success: true
          });
        }
      }
    })
    .subscribe();

  // Watch reservations
  supabase
    .channel('reservation-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, (payload) => {
      const sessionIds = [payload.new?.user_a, payload.new?.user_b, payload.new?.initiator_session_id, payload.new?.partner_session_id];
      sessionIds.forEach(sessionId => {
        if (!sessionId) return;
        const trail = store.getTrailBySessionId(sessionId);
        if (trail) {
          store.logAction(trail.userId, {
            timestamp: new Date().toISOString(),
            previousState: payload.old?.status || 'UNKNOWN',
            currentState: payload.new?.status || 'UNKNOWN',
            action: `DB:Reservation:${payload.eventType}`,
            result: JSON.stringify(payload.new || {}),
            durationMs: 0,
            success: true
          });
        }
      });
    })
    .subscribe();

  // Watch matches
  supabase
    .channel('matches-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload) => {
      const sessionIds = [payload.new?.user_a, payload.new?.user_b];
      sessionIds.forEach(sessionId => {
        if (!sessionId) return;
        const trail = store.getTrailBySessionId(sessionId);
        if (trail) {
          store.logAction(trail.userId, {
            timestamp: new Date().toISOString(),
            previousState: 'UNKNOWN',
            currentState: payload.new?.status || 'UNKNOWN',
            action: `DB:Match:${payload.eventType}`,
            result: JSON.stringify(payload.new || {}),
            durationMs: 0,
            success: true
          });
          
          if (payload.eventType === 'INSERT') {
            store.updateTrail(trail.userId, {
              matchAnalysis: {
                matchScore: payload.new.match_score,
                matchCriteriaUsed: null,
                queuePosition: 0,
                waitingTimeComparison: 0,
                preferenceApplied: null,
                reservationDetails: null,
                backendDecisionPath: [payload.new.matched_reason]
              }
            });
          }
        }
      });
    })
    .subscribe();
}
