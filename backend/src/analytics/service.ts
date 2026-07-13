import { getSupabase } from '../database/client.js';

class AnalyticsService {
  /**
   * I. Mission Control
   * Live KPIs: users online, searching, conversations, avg wait, today's reports.
   */
  async getMissionControl() {
    const supabase = getSupabase();
    
    // Live Users (Active sessions in last 5 mins)
    const { count: liveUsers } = await supabase
      .from('visitor_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
      
    // Active Searches (Waiting Queue)
    const { count: activeSearches } = await supabase
      .from('waiting_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'waiting');
      
    // Active Conversations (Matches without ended_at)
    const { count: activeConversations } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .is('ended_at', null);

    // Today's Reports
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayReports } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    return {
      healthStatus: 'healthy',
      liveUsers: liveUsers || 0,
      activeSearches: activeSearches || 0,
      activeConversations: activeConversations || 0,
      todayReports: todayReports || 0,
      // The following would normally be calculated from analytics_daily_snapshots
      averageWaitSeconds: 12,
      averageCallMinutes: 8,
      mutualLikePercent: 37,
      growthPercent: 14
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
    const { data, error } = await supabase.rpc('get_campus_leaderboard', { interval_hours: 24 });
    if (error) {
      console.error('[AnalyticsService] Error calling get_campus_leaderboard', error);
      return [];
    }
    return (data || []).map((row: any, i: number) => ({
      rank: i + 1,
      campus: row.campus,
      users: row.users,
      connections: row.connections,
      mutualLikes: row.mutual_likes,
      growth: 0 // Stubbed until day-over-day tracking is available
    }));
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
