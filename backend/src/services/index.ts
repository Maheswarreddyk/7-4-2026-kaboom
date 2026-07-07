import { v4 as uuidv4 } from 'uuid';
import {
  connectionLogRepository,
  feedbackRepository,
  matchRepository,
  metricsRepository,
  queueRepository,
  reportRepository,
  sessionRepository,
} from '../database/repositories/index.js';
import type {
  FeedbackRequest,
  ReportRequest,
  StartSessionRequest,
  StatsResponse,
  VisitorSession,
} from '../types/index.js';

export const sessionService = {
  async startSession(data: StartSessionRequest): Promise<VisitorSession> {
    const sessionToken = uuidv4();
    const session = await sessionRepository.create({
      sessionToken,
      country: data.country,
      browser: data.browser,
      device: data.device,
      platform: data.platform,
    });

    await connectionLogRepository.log(session.id, 'session_start', {
      country: data.country,
      browser: data.browser,
    });

    return session;
  },

  async endSession(sessionId: string): Promise<void> {
    await sessionRepository.endSession(sessionId);
    await connectionLogRepository.log(sessionId, 'session_end');
  },

  async getSession(sessionId: string): Promise<VisitorSession | null> {
    return sessionRepository.findById(sessionId);
  },

  async restoreSession(sessionId: string, sessionToken: string): Promise<VisitorSession | null> {
    const session = await sessionRepository.findById(sessionId);
    if (!session || session.session_token !== sessionToken || session.status === 'ended') {
      return null;
    }
    const { getSupabase } = await import('../database/client.js');
    await getSupabase()
      .from('visitor_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId);

    await connectionLogRepository.log(sessionId, 'reconnect');
    return session;
  },
};

export const statsService = {
  async getStats(onlineNow: number): Promise<StatsResponse> {
    const [activeUsers, waitingUsers, matchesToday] = await Promise.all([
      sessionRepository.countActive(),
      queueRepository.countWaiting(),
      matchRepository.countToday(),
    ]);

    return {
      activeUsers,
      waitingUsers,
      matchesToday,
      onlineNow,
    };
  },

  async recordMetrics(onlineNow: number): Promise<void> {
    const stats = await this.getStats(onlineNow);
    await metricsRepository.record(stats.activeUsers, stats.waitingUsers, stats.matchesToday);
  },
};

export const reportService = {
  async submitReport(data: ReportRequest) {
    const report = await reportRepository.create({
      reporterSessionId: data.reporterSessionId,
      reportedSessionId: data.reportedSessionId,
      reason: data.reason,
      notes: data.notes,
    });

    await connectionLogRepository.log(data.reporterSessionId, 'report', {
      reportedSessionId: data.reportedSessionId,
      reason: data.reason,
    });

    return report;
  },
};

export const feedbackService = {
  async submitFeedback(data: FeedbackRequest) {
    return feedbackRepository.create({
      sessionId: data.sessionId,
      rating: data.rating,
      feedback: data.feedback,
    });
  },
};

export const cleanupService = {
  async runCleanup(queueStaleMs: number, matchStaleMs: number): Promise<void> {
    const queueCutoff = new Date(Date.now() - queueStaleMs).toISOString();
    const matchCutoff = new Date(Date.now() - matchStaleMs).toISOString();
    const now = new Date().toISOString();

    // Stale heartbeat cutoff: 60s
    const heartbeatCutoff = new Date(Date.now() - 60_000).toISOString();

    const [queueExpired, matchExpired] = await Promise.all([
      queueRepository.expireStale(queueCutoff),
      matchRepository.expireStale(matchCutoff),
    ]);

    try {
      const supabase = (await import('../database/client.js')).getSupabase();
      const { invalidateMatchmakerCache, transitionSessionStatus } = await import('../matchmaking/matchingEngine.js');

      // 1. Expire stale heartbeat queue entries (V4.1 Requirement 12)
      const { data: staleSessionIds } = await supabase
        .from('visitor_sessions')
        .select('id')
        .in('status', ['SEARCHING', 'RESERVED', 'waiting', 'matched'])
        .lt('last_activity', heartbeatCutoff);

      if (staleSessionIds && staleSessionIds.length > 0) {
        const ids = staleSessionIds.map((s: { id: string }) => s.id);
        console.log(`[Cleanup] Expiring ${ids.length} stale heartbeat queue entries`);

        await supabase
          .from('waiting_queue')
          .update({ status: 'expired' })
          .in('session_id', ids)
          .eq('status', 'waiting');

        for (const id of ids) {
          await transitionSessionStatus(supabase, id, 'READY', 'Heartbeat cleanup');
        }
        invalidateMatchmakerCache();
      }

      // 2. Clean up expired reservations (V4.1 Requirement 3 & 12)
      const { data: expiredResvs } = await supabase
        .from('reservations')
        .update({ status: 'rolled_back' })
        .eq('status', 'pending')
        .lt('expires_at', now)
        .select('user_a, user_b');

      if (expiredResvs && expiredResvs.length > 0) {
        console.log(`[Cleanup] Rolled back ${expiredResvs.length} expired reservations`);
        for (const resv of expiredResvs) {
          for (const uid of [resv.user_a, resv.user_b]) {
            if (uid) {
              await transitionSessionStatus(supabase, uid, 'SEARCHING', 'Reservation expiration recovery');
            }
          }
        }
        invalidateMatchmakerCache();
      }

      // 3. Clean up expired temporary messages (V4.1 Requirement 12)
      const { error: msgErr } = await supabase
        .from('temporary_messages')
        .delete()
        .lt('expires_at', now);

      if (msgErr) {
        console.error('[Cleanup] Failed to clean up temporary messages:', msgErr.message);
      }

      // 4. Clean up orphaned matches (ended_at is null but users are not connected or are stale)
      const { data: activeMatches } = await supabase
        .from('matches')
        .select('id, user_a, user_b, started_at')
        .is('ended_at', null);

      if (activeMatches && activeMatches.length > 0) {
        for (const m of activeMatches) {
          const [resA, resB] = await Promise.all([
            supabase.from('visitor_sessions').select('status, last_activity').eq('id', m.user_a).maybeSingle(),
            supabase.from('visitor_sessions').select('status, last_activity').eq('id', m.user_b).maybeSingle(),
          ]);

          const staleA = !resA.data || !resA.data.last_activity || resA.data.last_activity < heartbeatCutoff;
          const staleB = !resB.data || !resB.data.last_activity || resB.data.last_activity < heartbeatCutoff;

          if (staleA || staleB) {
            console.log(`[Cleanup] Cleaning up orphaned match ${m.id}`);
            const duration = Math.floor((Date.now() - new Date(m.started_at).getTime()) / 1000);
            await supabase
              .from('matches')
              .update({
                ended_at: now,
                duration_seconds: duration,
                ended_reason: 'disconnect',
              })
              .eq('id', m.id);

            if (!staleA && m.user_a) {
              await transitionSessionStatus(supabase, m.user_a, 'SEARCHING', 'Cleanup partner disconnected');
            }
            if (!staleB && m.user_b) {
              await transitionSessionStatus(supabase, m.user_b, 'SEARCHING', 'Cleanup partner disconnected');
            }
            invalidateMatchmakerCache();
          }
        }
      }

    } catch (err) {
      console.error('[Cleanup] Advanced database cleanup failed:', err instanceof Error ? err.message : err);
    }

    if (queueExpired > 0 || matchExpired > 0) {
      console.log(`[Cleanup] Expired ${queueExpired} queue entries, ${matchExpired} matches`);
    }
  },
};

