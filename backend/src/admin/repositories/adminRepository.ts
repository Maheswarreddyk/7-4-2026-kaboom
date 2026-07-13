import { getSupabase } from '../../database/client.js';
import { matchmakerMetrics } from '../../matchmaking/matchingEngine.js';

// ============================================================
// Admin Repository — READ-ONLY Supabase queries
// NO INSERT / NO UPDATE / NO DELETE
// ============================================================

export const adminRepository = {

  // ── Overview ────────────────────────────────────────────
  async getOverview() {
    const supabase = getSupabase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      activeSessions,
      queueResult,
      matchesTodayResult,
      activeMatchesResult,
      likesTodayResult,
    ] = await Promise.all([
      supabase
        .from('visitor_sessions')
        .select('id, status', { count: 'exact' })
        .neq('status', 'ended')
        .gt('last_activity', new Date(Date.now() - 90_000).toISOString()),
      supabase
        .from('waiting_queue')
        .select('id, joined_at', { count: 'exact' })
        .eq('status', 'waiting'),
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .gte('started_at', startOfDay.toISOString()),
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .is('ended_at', null),
      supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString()),
    ]);

    // Calculate average wait time from live queue
    const queueEntries = queueResult.data || [];
    const now = Date.now();
    const waitTimes = queueEntries.map((e: any) =>
      Math.floor((now - new Date(e.joined_at).getTime()) / 1000)
    );
    const avgWait =
      waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a: number, b: number) => a + b, 0) / waitTimes.length)
        : 0;
    const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

    return {
      liveUsers: activeSessions.count ?? 0,
      searching: queueResult.count ?? 0,
      connected: activeMatchesResult.count ?? 0,
      queueLength: queueResult.count ?? 0,
      avgWaitSeconds: avgWait,
      maxWaitSeconds: maxWait,
      matchesToday: matchesTodayResult.count ?? 0,
      likesToday: likesTodayResult.count ?? 0,
      matchmakerMetrics: {
        totalSearchingUsers: matchmakerMetrics.totalSearchingUsers,
        averageWaitTime: matchmakerMetrics.averageWaitTime,
        maximumWaitTime: matchmakerMetrics.maximumWaitTime,
        successfulMatches: matchmakerMetrics.successfulMatches,
        failedMatches: matchmakerMetrics.failedMatches,
        rematches: matchmakerMetrics.rematches,
        abandonedSearches: matchmakerMetrics.abandonedSearches,
      },
    };
  },

  // ── Live Users ───────────────────────────────────────────
  async getLiveUsers() {
    const supabase = getSupabase();
    const cutoff = new Date(Date.now() - 90_000).toISOString();

    const { data, count } = await supabase
      .from('visitor_sessions')
      .select('id, status, country, city, browser, device, created_at, last_activity', { count: 'exact' })
      .neq('status', 'ended')
      .gt('last_activity', cutoff)
      .order('last_activity', { ascending: false })
      .limit(200);

    const sessions = data || [];
    const statusBreakdown: Record<string, number> = {};
    sessions.forEach((s: any) => {
      statusBreakdown[s.status] = (statusBreakdown[s.status] || 0) + 1;
    });

    return {
      total: count ?? 0,
      statusBreakdown,
      sessions: sessions.map((s: any) => ({
        id: s.id,
        status: s.status,
        country: s.country,
        city: s.city,
        browser: s.browser,
        device: s.device,
        onlineSince: s.created_at,
        lastActivity: s.last_activity,
      })),
    };
  },

  // ── Locations ────────────────────────────────────────────
  async getLocations() {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('visitor_sessions')
      .select('country, state, city')
      .neq('status', 'ended');

    const sessions = data || [];
    const countries: Record<string, number> = {};
    const states: Record<string, number> = {};
    const cities: Record<string, number> = {};

    sessions.forEach((s: any) => {
      if (s.country) countries[s.country] = (countries[s.country] || 0) + 1;
      if (s.state) states[s.state] = (states[s.state] || 0) + 1;
      if (s.city) cities[s.city] = (cities[s.city] || 0) + 1;
    });

    const sort = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, count]) => ({ name, count }));

    return {
      topCountries: sort(countries),
      topStates: sort(states),
      topCities: sort(cities),
    };
  },

  // ── Colleges ─────────────────────────────────────────────
  async getColleges() {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('visitor_sessions')
      .select('match_attributes')
      .not('match_attributes', 'is', null);

    const sessions = data || [];
    const universities: Record<string, number> = {};

    sessions.forEach((s: any) => {
      if (s.match_attributes && Array.isArray(s.match_attributes.university)) {
        s.match_attributes.university.forEach((u: string) => {
          if (u) universities[u] = (universities[u] || 0) + 1;
        });
      } else if (s.match_attributes && typeof s.match_attributes.university === 'string') {
        const u = s.match_attributes.university;
        if (u) universities[u] = (universities[u] || 0) + 1;
      }
    });

    return {
      total: Object.keys(universities).length,
      topUniversities: Object.entries(universities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([name, count]) => ({ name, count })),
    };
  },

  // ── Filters ──────────────────────────────────────────────
  async getFilters() {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('visitor_sessions')
      .select('interest_tags, languages, country, state, city, gender, looking_for, match_mode')
      .neq('status', 'ended');

    const sessions = data || [];
    const interests: Record<string, number> = {};
    const languages: Record<string, number> = {};
    const genders: Record<string, number> = {};
    const lookingFor: Record<string, number> = {};
    const matchModes: Record<string, number> = {};

    sessions.forEach((s: any) => {
      if (Array.isArray(s.interest_tags)) {
        s.interest_tags.forEach((t: string) => {
          interests[t] = (interests[t] || 0) + 1;
        });
      }
      if (Array.isArray(s.languages)) {
        s.languages.forEach((l: string) => {
          languages[l] = (languages[l] || 0) + 1;
        });
      }
      if (s.gender) genders[s.gender] = (genders[s.gender] || 0) + 1;
      if (Array.isArray(s.looking_for)) {
        s.looking_for.forEach((lf: string) => {
          lookingFor[lf] = (lookingFor[lf] || 0) + 1;
        });
      }
      if (s.match_mode) matchModes[s.match_mode] = (matchModes[s.match_mode] || 0) + 1;
    });

    const sort = (obj: Record<string, number>, limit = 20) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));

    return {
      topInterests: sort(interests),
      topLanguages: sort(languages),
      genderBreakdown: sort(genders, 10),
      lookingForBreakdown: sort(lookingFor, 10),
      matchModeBreakdown: sort(matchModes, 10),
    };
  },

  // ── Devices ──────────────────────────────────────────────
  async getDevices() {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('visitor_sessions')
      .select('browser, device, platform')
      .neq('status', 'ended');

    const sessions = data || [];
    const browsers: Record<string, number> = {};
    const devices: Record<string, number> = {};
    const platforms: Record<string, number> = {};

    sessions.forEach((s: any) => {
      if (s.browser) browsers[s.browser] = (browsers[s.browser] || 0) + 1;
      if (s.device) devices[s.device] = (devices[s.device] || 0) + 1;
      if (s.platform) platforms[s.platform] = (platforms[s.platform] || 0) + 1;
    });

    const sort = (obj: Record<string, number>) =>
      Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name, count }));

    return {
      topBrowsers: sort(browsers),
      topDevices: sort(devices),
      topPlatforms: sort(platforms),
    };
  },

  // ── Queue ────────────────────────────────────────────────
  async getQueue() {
    const supabase = getSupabase();
    const { data, count } = await supabase
      .from('waiting_queue')
      .select('id, session_id, joined_at, status', { count: 'exact' })
      .eq('status', 'waiting')
      .order('joined_at', { ascending: true })
      .limit(100);

    const entries = data || [];
    const now = Date.now();
    const waitTimes = entries.map((e: any) =>
      Math.floor((now - new Date(e.joined_at).getTime()) / 1000)
    );
    const avgWait =
      waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a: number, b: number) => a + b, 0) / waitTimes.length)
        : 0;
    const maxWait = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

    // Historical queue stats
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: expiredCount } = await supabase
      .from('waiting_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'expired')
      .gte('joined_at', last24h);

    const { count: matchedCount } = await supabase
      .from('waiting_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'matched')
      .gte('joined_at', last24h);

    return {
      currentlyWaiting: count ?? 0,
      avgWaitSeconds: avgWait,
      maxWaitSeconds: maxWait,
      last24h: {
        matched: matchedCount ?? 0,
        expired: expiredCount ?? 0,
      },
      queue: entries.map((e: any, i: number) => ({
        position: i + 1,
        sessionId: e.session_id,
        joinedAt: e.joined_at,
        waitSeconds: waitTimes[i],
      })),
    };
  },

  // ── Matches ──────────────────────────────────────────────
  async getMatches() {
    const supabase = getSupabase();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      todayMatches,
      activeMatches,
      endedToday,
      mutualLikes,
      recentMatches,
    ] = await Promise.all([
      supabase
        .from('matches')
        .select('id, started_at, ended_at, duration_seconds, ended_reason, liked_by_a, liked_by_b', { count: 'exact' })
        .gte('started_at', startOfDay.toISOString()),
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .is('ended_at', null),
      supabase
        .from('matches')
        .select('id, ended_reason', { count: 'exact' })
        .not('ended_at', 'is', null)
        .gte('ended_at', startOfDay.toISOString()),
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('liked_by_a', true)
        .eq('liked_by_b', true)
        .gte('started_at', startOfDay.toISOString()),
      supabase
        .from('matches')
        .select('id, started_at, ended_at, duration_seconds, ended_reason, liked_by_a, liked_by_b, user_a, user_b')
        .order('started_at', { ascending: false })
        .limit(50),
    ]);

    const todayData = todayMatches.data || [];
    const durationsCompleted = todayData
      .filter((m: any) => m.duration_seconds !== null)
      .map((m: any) => m.duration_seconds as number);
    const avgDuration =
      durationsCompleted.length > 0
        ? Math.round(durationsCompleted.reduce((a: number, b: number) => a + b, 0) / durationsCompleted.length)
        : 0;

    // End reason breakdown
    const endedData = endedToday.data || [];
    const endReasons: Record<string, number> = {};
    endedData.forEach((m: any) => {
      const r = m.ended_reason || 'unknown';
      endReasons[r] = (endReasons[r] || 0) + 1;
    });

    return {
      matchesToday: todayMatches.count ?? 0,
      activeNow: activeMatches.count ?? 0,
      endedToday: endedToday.count ?? 0,
      mutualLikesToday: mutualLikes.count ?? 0,
      avgDurationSeconds: avgDuration,
      endReasonBreakdown: endReasons,
      recentMatches: (recentMatches.data || []).map((m: any) => ({
        id: m.id,
        startedAt: m.started_at,
        endedAt: m.ended_at,
        durationSeconds: m.duration_seconds,
        endedReason: m.ended_reason,
        mutualLike: m.liked_by_a && m.liked_by_b,
      })),
    };
  },

  // ── Server Metrics History ────────────────────────────────
  async getMetricsHistory(limit = 60) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('server_metrics')
      .select('active_users, waiting_users, matches_today, timestamp')
      .order('timestamp', { ascending: false })
      .limit(limit);

    return (data || []).reverse();
  },
};
