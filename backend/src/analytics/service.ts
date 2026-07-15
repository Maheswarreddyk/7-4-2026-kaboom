import { getSupabase } from '../database/client.js';

export class AnalyticsService {
  async getOverview() {
    const { data } = await getSupabase().from('dashboard_summary').select('*').eq('id', 1).maybeSingle();
    return data || {};
  }

  async getTrends() {
    // Return last 24 hours and last 30 days
    const [hourlyRes, dailyRes] = await Promise.all([
      getSupabase().from('dashboard_hourly').select('*').order('hour_timestamp', { ascending: false }).limit(24),
      getSupabase().from('dashboard_daily').select('*').order('date_timestamp', { ascending: false }).limit(30)
    ]);
    return {
      hourly: hourlyRes.data?.reverse() || [],
      daily: dailyRes.data?.reverse() || []
    };
  }

  async getAudience() {
    const { data } = await getSupabase().from('dashboard_rankings').select('*').order('count', { ascending: false });
    return data || [];
  }

  async getMatchAnalytics() {
    const { data } = await getSupabase().from('dashboard_match_analytics').select('*').eq('id', 1).maybeSingle();
    return data || {};
  }

  async getNotifications() {
    const { data } = await getSupabase().from('dashboard_notifications').select('*').eq('id', 1).maybeSingle();
    return data || {};
  }

  async getActivityFeed() {
    const { data } = await getSupabase()
      .from('dashboard_activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }
}

export const analyticsService = new AnalyticsService();
