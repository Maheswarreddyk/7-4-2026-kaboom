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

    // Phase 2: Also clean up waiting_queue entries where the session heartbeat is dead.
    // HEARTBEAT_STALE_MS is 45s — these are sessions that stopped polling (mobile background).
    // We use 60s here to give a wider margin than the matchmaker's 45s filter.
    const heartbeatCutoff = new Date(Date.now() - 60_000).toISOString();

    const [queueExpired, matchExpired] = await Promise.all([
      queueRepository.expireStale(queueCutoff),
      matchRepository.expireStale(matchCutoff),
    ]);

    // Expire waiting_queue entries whose session heartbeat is dead
    try {
      const supabase = (await import('../database/client.js')).getSupabase();

      // Find sessions that are marked 'waiting' but have no recent activity
      const { data: staleSessionIds } = await supabase
        .from('visitor_sessions')
        .select('id')
        .in('status', ['waiting', 'matched'])
        .lt('last_activity', heartbeatCutoff);

      if (staleSessionIds && staleSessionIds.length > 0) {
        const ids = staleSessionIds.map((s: { id: string }) => s.id);
        console.log(`[Cleanup] Expiring ${ids.length} stale heartbeat queue entries`);

        await supabase
          .from('waiting_queue')
          .update({ status: 'expired' })
          .in('session_id', ids)
          .eq('status', 'waiting');

        await supabase
          .from('visitor_sessions')
          .update({ status: 'active', queue_entered_at: null })
          .in('id', ids);
      }
    } catch (err) {
      console.error('[Cleanup] Heartbeat stale cleanup failed:', err instanceof Error ? err.message : err);
    }

    if (queueExpired > 0 || matchExpired > 0) {
      console.log(`[Cleanup] Expired ${queueExpired} queue entries, ${matchExpired} matches`);
    }
  },
};

