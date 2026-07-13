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
    
    // In a real scenario, this would aggregate QUEUE_JOINED vs MATCH_FOUND over the last 24h.
    // For MVP, we will query analytics_events where event_type = QUEUE_JOINED or MATCH_FOUND
    const { data: queueEvents } = await supabase
      .from('analytics_events')
      .select('payload')
      .eq('event_type', 'QUEUE_JOINED');

    const { data: matchEvents } = await supabase
      .from('analytics_events')
      .select('payload')
      .eq('event_type', 'MATCH_FOUND');

    // MOCK DATA for now until we have real data injected by the MatchScheduler
    return [
      { campus: 'Saveetha', demand: 220, supply: 61, gap: 159 },
      { campus: 'SRM', demand: 180, supply: 140, gap: 40 },
      { campus: 'VIT', demand: 90, supply: 85, gap: 5 }
    ];
  }

  /**
   * II. Product Intelligence: Match Quality
   * Compares SMART vs EXACT vs QUICK
   */
  async getMatchQuality() {
    return [
      { mode: 'SMART', users: 520, avgWaitSec: 12, avgDurationMin: 7, mutualLikePct: 38 },
      { mode: 'EXACT', users: 180, avgWaitSec: 48, avgDurationMin: 15, mutualLikePct: 61 },
      { mode: 'QUICK', users: 890, avgWaitSec: 4, avgDurationMin: 3, mutualLikePct: 12 }
    ];
  }

  /**
   * II. Product Intelligence: Campus Leaderboard
   */
  async getCampusLeaderboard() {
    return [
      { rank: 1, campus: 'Saveetha', users: 450, connections: 890, mutualLikes: 320, growth: 12 },
      { rank: 2, campus: 'SRM', users: 310, connections: 600, mutualLikes: 180, growth: -4 },
      { rank: 3, campus: 'SVCE', users: 120, connections: 150, mutualLikes: 40, growth: 45 }
    ];
  }

  /**
   * III. Growth & Campaigns: Funnel
   * 9-Step Funnel
   */
  async getFunnel() {
    return [
      { step: 'Landing', count: 5000, dropoff: 0 },
      { step: 'Opened Modal', count: 2500, dropoff: 50 },
      { step: 'Entered Name', count: 2000, dropoff: 20 },
      { step: 'Clicked Start', count: 1800, dropoff: 10 },
      { step: 'Queue', count: 1750, dropoff: 2.7 },
      { step: 'Matched', count: 1600, dropoff: 8.5 },
      { step: 'Stayed 30s', count: 1200, dropoff: 25 },
      { step: 'Liked', count: 400, dropoff: 66 },
      { step: 'Returned Tomorrow', count: 250, dropoff: 37 }
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
