import { getSupabase, handleSupabaseError } from '../client.js';
import type {
  ConnectionEvent,
  ConnectionLog,
  Feedback,
  Match,
  MatchEndReason,
  Report,
  ReportReason,
  ServerMetrics,
  SessionStatus,
  VisitorSession,
  WaitingQueueEntry,
} from '../../types/index.js';

export const sessionRepository = {
  async create(data: {
    sessionToken: string;
    authUserId?: string;
    country?: string;
    browser?: string;
    device?: string;
    platform?: string;
  }): Promise<VisitorSession> {
    const insertData: any = {
      session_token: data.sessionToken,
      country: data.country ?? null,
      browser: data.browser ?? null,
      device: data.device ?? null,
      platform: data.platform ?? null,
      status: 'READY',
      supabase_user_id: data.authUserId ?? null,
    };

    const { data: session, error } = await getSupabase()
      .from('visitor_sessions')
      .insert(insertData)
      .select()
      .single();

    if (error || !session) handleSupabaseError(error, 'Failed to create session');
    return session as VisitorSession;
  },

  async findById(id: string): Promise<VisitorSession | null> {
    const { data, error } = await getSupabase()
      .from('visitor_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Failed to find session');
    return data as VisitorSession | null;
  },

  async findByToken(token: string): Promise<VisitorSession | null> {
    const { data, error } = await getSupabase()
      .from('visitor_sessions')
      .select('*')
      .eq('session_token', token)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Failed to find session by token');
    return data as VisitorSession | null;
  },

  async updateStatus(id: string, status: SessionStatus): Promise<void> {
    const { error } = await getSupabase()
      .from('visitor_sessions')
      .update({ status })
      .eq('id', id);

    if (error) handleSupabaseError(error, 'Failed to update session status');
  },

  async endSession(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('visitor_sessions')
      .update({
        status: 'TERMINATED',
        ended_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) handleSupabaseError(error, 'Failed to end session');
  },

  async countActive(): Promise<number> {
    // DEFECT-002 Fix: legacy query used lowercase 'active' which no longer exists.
    // Count sessions that are in any live (non-terminal) state instead.
    const { count, error } = await getSupabase()
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['READY', 'SEARCHING', 'RESERVED', 'MATCHED', 'SIGNALING', 'CONNECTED', 'PARTNER_LEFT', 'REQUEUEING']);

    if (error) handleSupabaseError(error, 'Failed to count active sessions');
    return count ?? 0;
  },
};

export const queueRepository = {
  async join(sessionId: string): Promise<WaitingQueueEntry> {
    // Idempotent: clear any existing waiting entry before re-joining
    await getSupabase()
      .from('waiting_queue')
      .update({ status: 'left' })
      .eq('session_id', sessionId)
      .eq('status', 'waiting');

    const { data, error } = await getSupabase()
      .from('waiting_queue')
      .insert({
        session_id: sessionId,
        status: 'waiting',
      })
      .select()
      .single();

    if (error || !data) handleSupabaseError(error, 'Failed to join queue');
    return data as WaitingQueueEntry;
  },

  async leave(sessionId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('waiting_queue')
      .update({ status: 'left' })
      .eq('session_id', sessionId)
      .eq('status', 'waiting');

    if (error) handleSupabaseError(error, 'Failed to leave queue');
  },

  async markMatched(sessionId: string): Promise<void> {
    const { error } = await getSupabase()
      .from('waiting_queue')
      .update({ status: 'matched' })
      .eq('session_id', sessionId)
      .eq('status', 'waiting');

    if (error) handleSupabaseError(error, 'Failed to mark queue entry matched');
  },

  async countWaiting(): Promise<number> {
    const { count, error } = await getSupabase()
      .from('waiting_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');

    if (error) handleSupabaseError(error, 'Failed to count waiting users');
    return count ?? 0;
  },

  async expireStale(cutoffIso: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('waiting_queue')
      .update({ status: 'expired' })
      .eq('status', 'waiting')
      .lt('joined_at', cutoffIso)
      .select('id');

    if (error) handleSupabaseError(error, 'Failed to expire stale queue entries');
    return data?.length ?? 0;
  },
};

export const matchRepository = {
  async create(userA: string, userB: string, matchScore?: number, matchedReason?: string): Promise<Match> {
    const { data, error } = await getSupabase()
      .from('matches')
      .insert({
        user_a: userA,
        user_b: userB,
        match_score: matchScore ?? null,
        matched_reason: matchedReason ?? null,
      })
      .select()
      .single();

    if (error || !data) handleSupabaseError(error, 'Failed to create match');
    return data as Match;
  },

  async findActiveMatchBySessionId(sessionId: string): Promise<Match | null> {
    const { data, error } = await getSupabase()
      .from('matches')
      .select('*')
      .is('ended_at', null)
      .or(`user_a.eq.${sessionId},user_b.eq.${sessionId}`)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Failed to find active match');
    return data as Match | null;
  },

  async endMatch(id: string, reason: MatchEndReason): Promise<Match | null> {
    const { data: existing } = await getSupabase()
      .from('matches')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existing) return null;

    const startedAt = new Date(existing.started_at).getTime();
    const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);

    const { data, error } = await getSupabase()
      .from('matches')
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        ended_reason: reason,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) handleSupabaseError(error, 'Failed to end match');
    return data as Match;
  },

  async countToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count, error } = await getSupabase()
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', startOfDay.toISOString());

    if (error) handleSupabaseError(error, 'Failed to count today matches');
    return count ?? 0;
  },

  async expireStale(cutoffIso: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('matches')
      .update({
        ended_at: new Date().toISOString(),
        ended_reason: 'timeout',
        duration_seconds: 0,
      })
      .is('ended_at', null)
      .lt('started_at', cutoffIso)
      .select('id');

    if (error) handleSupabaseError(error, 'Failed to expire stale matches');

    if (data && data.length > 0) {
      const matchIds = data.map((m: any) => m.id);
      await getSupabase().from('temporary_messages').delete().in('match_id', matchIds);
      await getSupabase().from('reservations').delete().in('match_id', matchIds);
    }

    return data?.length ?? 0;
  },
};

export const reportRepository = {
  async create(data: {
    reporterSessionId: string;
    reportedSessionId: string;
    reason: ReportReason;
    notes?: string;
  }): Promise<Report> {
    const { data: report, error } = await getSupabase()
      .from('reports')
      .insert({
        reporter_session: data.reporterSessionId,
        reported_session: data.reportedSessionId,
        reason: data.reason,
        notes: data.notes ?? null,
      })
      .select()
      .single();

    if (error || !report) handleSupabaseError(error, 'Failed to create report');
    return report as Report;
  },
};

export const feedbackRepository = {
  async create(data: {
    sessionId: string;
    rating: number;
    feedback?: string;
  }): Promise<Feedback> {
    const { data: entry, error } = await getSupabase()
      .from('feedback')
      .insert({
        session_id: data.sessionId,
        rating: data.rating,
        feedback: data.feedback ?? null,
      })
      .select()
      .single();

    if (error || !entry) handleSupabaseError(error, 'Failed to create feedback');
    return entry as Feedback;
  },
};

export const metricsRepository = {
  async record(activeUsers: number, waitingUsers: number, matchesToday: number): Promise<ServerMetrics> {
    const { data, error } = await getSupabase()
      .from('server_metrics')
      .insert({
        active_users: activeUsers,
        waiting_users: waitingUsers,
        matches_today: matchesToday,
      })
      .select()
      .single();

    if (error || !data) handleSupabaseError(error, 'Failed to record server metrics');
    return data as ServerMetrics;
  },

  async flushMatchmakerMetrics(
    totalSearching: number,
    avgWait: number,
    maxWait: number,
    succMatches: number,
    failMatches: number,
    rematches: number,
    abandoned: number
  ): Promise<void> {
    const { error } = await getSupabase().rpc('update_matchmaker_metrics', {
      p_total_searching_users: totalSearching,
      p_avg_wait: avgWait,
      p_max_wait: maxWait,
      p_succ: succMatches,
      p_fail: failMatches,
      p_rematches: rematches,
      p_abandoned: abandoned
    });
    if (error) {
      console.error('[Metrics] Failed to flush global matchmaker metrics to DB:', error);
    }
  },

  async getGlobalMatchmakerMetrics(): Promise<any> {
    const { data, error } = await getSupabase()
      .from('matchmaker_metrics')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (error) {
      console.warn('[Metrics] Could not read global matchmaker metrics, defaulting to 0');
      return {
        total_searching_users: 0,
        average_wait_time: 0,
        maximum_wait_time: 0,
        successful_matches: 0,
        failed_matches: 0,
        rematches: 0,
        abandoned_searches: 0
      };
    }
    return data;
  },

  async getLatest(): Promise<ServerMetrics | null> {
    const { data, error } = await getSupabase()
      .from('server_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) handleSupabaseError(error, 'Failed to get latest metrics');
    return data as ServerMetrics | null;
  },
};

export const connectionLogRepository = {
  async log(
    sessionId: string | null,
    event: ConnectionEvent,
    details: Record<string, unknown> = {}
  ): Promise<ConnectionLog> {
    const { data, error } = await getSupabase()
      .from('connection_logs')
      .insert({
        session_id: sessionId,
        event,
        details,
      })
      .select()
      .single();

    if (error || !data) handleSupabaseError(error, 'Failed to log connection event');
    return data as ConnectionLog;
  },
};
