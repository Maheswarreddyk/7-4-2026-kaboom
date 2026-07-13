import { getSupabase } from '../database/client.js';

class AnalyticsService {
  /**
   * I. Mission Control
   * Live KPIs: users online, searching, conversations, avg wait, today's reports.
   * "If I open Kaboom after waking up, what do I need to know in the next 10 seconds?"
   */
  async getMissionControl() {
    const supabase = getSupabase();
    
    // Live Users (Active sessions in last 5 mins)
    // SQL: SELECT COUNT(*) FROM visitor_sessions WHERE status = 'active';
    const { count: liveUsers } = await supabase
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
      
    // Active Searches (Waiting Queue)
    // SQL: SELECT COUNT(*) FROM waiting_queue WHERE status = 'waiting';
    const { count: activeSearches } = await supabase
      .from('waiting_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');
      
    // Active Conversations (Matches without ended_at)
    // SQL: SELECT COUNT(*) FROM matches WHERE ended_at IS NULL;
    const { count: activeConversations } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .is('ended_at', null);

    // Today's boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    // Yesterday's boundaries
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayIso = yesterday.toISOString();

    // Today's Reports
    const { count: todayReports } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayIso);

    // Today's New Users
    const { count: todayNewUsers } = await supabase
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayIso);

    // Yesterday's New Users (for growth calculation)
    const { count: yesterdayNewUsers } = await supabase
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterdayIso)
      .lt('created_at', todayIso);

    const growthPercent = yesterdayNewUsers ? Math.round(((todayNewUsers || 0) - yesterdayNewUsers) / yesterdayNewUsers * 100) : 0;

    // Today's Matches
    const { count: todayMatches } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayIso);

    // Fetch wait times and call durations directly from recent events to avoid heavy RPCs
    // Using last 100 MATCH_FOUND and CALL_ENDED events to calculate rolling averages
    const [matchesRes, callsRes, mutualLikesRes, pushSentRes, sessionsRes] = await Promise.all([
      supabase.from('analytics_events')
        .select('payload')
        .eq('event_type', 'MATCH_FOUND')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('analytics_events')
        .select('payload')
        .eq('event_type', 'CALL_ENDED')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('likes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayIso),
      supabase.from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'NOTIFICATION_SENT')
        .gte('created_at', todayIso),
      supabase.from('visitor_sessions')
        .select('country, city, payload')
        .gte('created_at', todayIso)
        .limit(1000)
    ]);

    let avgWait = 0;
    if (matchesRes.data && matchesRes.data.length > 0) {
      const waitTimes = matchesRes.data.map((r: any) => Number(r.payload?.wait_time_sec) || 0);
      avgWait = Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length);
    }

    let avgCallMin = 0;
    if (callsRes.data && callsRes.data.length > 0) {
      const callTimes = callsRes.data.map((r: any) => Number(r.payload?.duration_sec) || 0);
      avgCallMin = Math.round((callTimes.reduce((a, b) => a + b, 0) / callTimes.length) / 60);
    }

    // Calculate top campus and top city
    let topCampus = 'Unknown';
    let topCity = 'Unknown';
    
    if (sessionsRes.data && sessionsRes.data.length > 0) {
      const campusCounts = new Map<string, number>();
      const cityCounts = new Map<string, number>();
      
      for (const s of sessionsRes.data) {
        const campus = s.payload?.campus || 'Unknown';
        if (campus !== 'Unknown') campusCounts.set(campus, (campusCounts.get(campus) || 0) + 1);
        
        const city = s.city || 'Unknown';
        if (city !== 'Unknown') cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      }
      
      let maxCampus = 0;
      for (const [c, count] of campusCounts.entries()) {
        if (count > maxCampus) { maxCampus = count; topCampus = c; }
      }
      
      let maxCity = 0;
      for (const [c, count] of cityCounts.entries()) {
        if (count > maxCity) { maxCity = count; topCity = c; }
      }
    }

    const mutualLikePercent = todayMatches ? Math.round(((mutualLikesRes.count || 0) / 2) / todayMatches * 100) : 0;

    return {
      healthStatus: 'healthy',
      liveUsers: liveUsers || 0,
      activeSearches: activeSearches || 0,
      activeConversations: activeConversations || 0,
      todayReports: todayReports || 0,
      todayNewUsers: todayNewUsers || 0,
      todayMatches: todayMatches || 0,
      averageWaitSeconds: avgWait,
      averageCallMinutes: avgCallMin,
      mutualLikePercent: Math.min(mutualLikePercent, 100),
      growthPercent,
      topCampus,
      topCity,
      todayDeliveries: pushSentRes.count || 0
    };
  }

  /**
   * II. Product Intelligence: Search Demand
   * Calculates Demand vs Supply = Gap for top Campuses.
   */
  async getSearchDemand() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_search_demand', { interval_hours: 24 });
    if (error) {
      console.error('[AnalyticsService] Error calling get_search_demand', error);
      return [];
    }
    return data || [];
  }

  async getMatchQuality() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_match_quality', { interval_hours: 24 });
    if (error) {
      console.error('[AnalyticsService] Error calling get_match_quality', error);
      return [];
    }
    // Map DB fields to what frontend expects
    return (data || []).map((row: any) => ({
      mode: row.mode,
      users: row.users,
      avgWaitSec: row.avg_wait_sec,
      avgDurationMin: row.avg_duration_min,
      mutualLikePct: row.mutual_like_pct
    }));
  }

  async getCampusLeaderboard() {
    const supabase = getSupabase();
    // Get last 24h
    const { data: todayData, error: todayErr } = await supabase.rpc('get_campus_leaderboard', { interval_hours: 24 });
    // Get last 48h to calculate yesterday
    const { data: twoDaysData, error: twoDaysErr } = await supabase.rpc('get_campus_leaderboard', { interval_hours: 48 });
    
    if (todayErr || twoDaysErr) {
      console.error('[AnalyticsService] Error calling get_campus_leaderboard');
      return [];
    }

    const twoDaysMap = new Map((twoDaysData || []).map((row: any) => [row.campus, row]));

    return (todayData || []).map((row: any, i: number) => {
      let growth = 0;
      const twoDays: any = twoDaysMap.get(row.campus);
      
      if (twoDays) {
        // Yesterday's users = (last 48h users) - (last 24h users)
        const yesterdayUsers = Math.max(0, twoDays.users - row.users);
        if (yesterdayUsers > 0) {
          growth = Math.round(((row.users - yesterdayUsers) / yesterdayUsers) * 100);
        } else if (row.users > 0) {
          growth = 100; // infinite growth from 0
        }
      }

      return {
        rank: i + 1,
        campus: row.campus,
        users: row.users,
        connections: row.connections,
        mutualLikes: row.mutual_likes,
        growth: Math.min(growth, 999) // Cap at 999%
      };
    });
  }

  async getFunnel() {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_funnel_metrics', { interval_hours: 24 });
    
    if (error || !data) {
      console.error('[AnalyticsService] Error calling get_funnel_metrics', error);
      return [];
    }

    const counts = {
      landing: data.find((r: any) => r.event_type === 'SESSION_STARTED')?.event_count || 0,
      queue: data.find((r: any) => r.event_type === 'QUEUE_JOINED')?.event_count || 0,
      matched: data.find((r: any) => r.event_type === 'MATCH_FOUND')?.event_count || 0,
      connected: data.find((r: any) => r.event_type === 'CALL_CONNECTED')?.event_count || 0,
      liked: data.find((r: any) => r.event_type === 'MUTUAL_LIKE')?.event_count || 0,
      feedback: data.find((r: any) => r.event_type === 'FEEDBACK_SUBMITTED')?.event_count || 0
    };

    const calcDropoff = (current: number, previous: number) => {
      if (previous === 0) return 0;
      return Math.round(((previous - current) / previous) * 100);
    };

    return [
      { step: 'Landing', count: counts.landing, dropoff: 0 },
      { step: 'Queue', count: counts.queue, dropoff: calcDropoff(counts.queue, counts.landing) },
      { step: 'Matched', count: counts.matched, dropoff: calcDropoff(counts.matched, counts.queue) },
      { step: 'Connected', count: counts.connected, dropoff: calcDropoff(counts.connected, counts.matched) },
      { step: 'Mutual Like', count: counts.liked, dropoff: calcDropoff(counts.liked, counts.connected) },
      { step: 'Feedback Given', count: counts.feedback, dropoff: calcDropoff(counts.feedback, counts.liked) }
    ];
  }

  /**
   * IV. Operations: Live Sessions
   */
  async getLiveSessions() {
    const supabase = getSupabase();
    
    // Fetch last 50 active sessions
    const { data: sessions } = await supabase
      .from('visitor_sessions')
      .select('id, country, city, device, browser, status, last_activity')
      .order('last_activity', { ascending: false })
      .limit(50);
      
    return sessions || [];
  }
}

export const analyticsService = new AnalyticsService();
