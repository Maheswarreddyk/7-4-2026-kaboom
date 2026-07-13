import { getSupabase } from '../database/client.js';
import { matchingEngine } from '../services/matchingEngine.js';

/**
 * AnalyticsService (Hybrid Data Fetcher)
 * 
 * Fetches LIVE data from production tables (visitor_sessions, waiting_queue, matches)
 * and HISTORICAL data from analytics_events.
 */
export const analyticsService = {
  
  // ==========================================
  // LIVE DATA (From Production Tables/Memory)
  // ==========================================
  
  async getLiveOverview() {
    const supabase = getSupabase();
    
    // Live Users (active in last 90s)
    const ninetySecondsAgo = new Date(Date.now() - 90 * 1000).toISOString();
    const { count: liveUsers } = await supabase
      .from('visitor_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('last_activity', ninetySecondsAgo);
      
    // Queue Size
    const { count: queueSize } = await supabase
      .from('waiting_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'waiting');
      
    // Active Calls (matches with no ended_at)
    const { count: activeCalls } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .is('ended_at', null);

    return {
      liveUsers: liveUsers || 0,
      queueSize: queueSize || 0,
      activeCalls: activeCalls || 0,
      engineOnlineCount: matchingEngine.getOnlineCount(),
    };
  },

  async getLiveUsers() {
    const supabase = getSupabase();
    const ninetySecondsAgo = new Date(Date.now() - 90 * 1000).toISOString();
    
    const { data: sessions, error } = await supabase
      .from('visitor_sessions')
      .select('id, status, country, city, device, browser, platform, last_activity')
      .gte('last_activity', ninetySecondsAgo)
      .order('last_activity', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    
    // Calculate breakdown
    const breakdown: Record<string, number> = {};
    sessions.forEach(s => {
      breakdown[s.status] = (breakdown[s.status] || 0) + 1;
    });
    
    return {
      total: sessions.length,
      breakdown,
      sessions,
    };
  },

  // ==========================================
  // HISTORICAL DATA (From analytics_events)
  // ==========================================
  
  async getHistoricalOverview() {
    const supabase = getSupabase();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    // Example: Fetch events for today
    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('event_type')
      .gte('created_at', startOfToday.toISOString());
      
    if (error) throw error;
    
    const metrics = {
      queueJoined: 0,
      matchesFound: 0,
      callsConnected: 0,
      mutualLikes: 0,
      reports: 0
    };
    
    events.forEach(e => {
      if (e.event_type === 'QUEUE_JOINED') metrics.queueJoined++;
      if (e.event_type === 'MATCH_FOUND') metrics.matchesFound++;
      if (e.event_type === 'CALL_CONNECTED') metrics.callsConnected++;
      if (e.event_type === 'MUTUAL_LIKE') metrics.mutualLikes++;
      if (e.event_type === 'REPORT_SUBMITTED') metrics.reports++;
    });
    
    return metrics;
  },
  
  async getCampusAnalytics() {
    // Specifically focused on colleges/universities.
    // Fetch live sessions with a college filter in match_attributes, or parse from analytics events.
    // For MVP, we will query visitor_sessions or analytics_events where payload->'college' is present.
    const supabase = getSupabase();
    
    // In a real scenario, this requires joining or parsing JSON.
    // We will do a generic event pull for FILTER_SELECTED to see popular campuses.
    const { data: campusEvents, error } = await supabase
      .from('analytics_events')
      .select('payload')
      .eq('event_type', 'FILTER_SELECTED');
      
    if (error) throw error;
    
    const campusCounts: Record<string, number> = {};
    campusEvents.forEach(e => {
      const p = e.payload as any;
      if (p.filterType === 'college' && p.value) {
        campusCounts[p.value] = (campusCounts[p.value] || 0) + 1;
      }
    });
    
    // Sort descending
    return Object.entries(campusCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
};
