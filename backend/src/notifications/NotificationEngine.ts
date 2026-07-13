import { getSupabase } from '../database/client.js';

export class NotificationEngine {
  
  // Enforces rate limits based on notification category
  static async checkRateLimit(subscriptionId: string, category: string): Promise<boolean> {
    if (category === 'critical' || category === 'security') return true;

    const supabase = getSupabase();
    
    // Default rule: 2 promotional per day
    const timeWindow = category === 'campus' ? '7 days' : '1 day';
    const limit = category === 'campus' ? 3 : 2;

    const { count } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event', 'NOTIFICATION_SENT')
      .contains('details', { subscriptionId, category })
      .gte('created_at', new Date(Date.now() - this.parseInterval(timeWindow)).toISOString());

    return (count || 0) < limit;
  }

  // Quiet Hours (11 PM to 7 AM local)
  static isQuietHours(): boolean {
    const hour = new Date().getHours();
    return hour >= 23 || hour < 7;
  }

  // Resolve Audience targeting rules
  static async resolveAudience(filters: Record<string, any>): Promise<any[]> {
    const supabase = getSupabase();
    
    let query = supabase
      .from('user_preferences_cache')
      .select('subscription_id, push_subscriptions!inner(subscription_json, enabled)');

    // Ensure they have push enabled
    query = query.eq('push_subscriptions.enabled', true);

    // Apply Segment Filters
    if (filters.campus) query = query.eq('college', filters.campus);
    if (filters.city) query = query.eq('city', filters.city);
    if (filters.state) query = query.eq('state', filters.state);
    if (filters.country) query = query.eq('country', filters.country);
    if (filters.matchMode) query = query.eq('match_mode', filters.matchMode);
    
    if (filters.interests && filters.interests.length > 0) {
      query = query.contains('interests', filters.interests);
    }
    if (filters.languages && filters.languages.length > 0) {
      query = query.contains('languages', filters.languages);
    }

    const { data } = await query;
    return data || [];
  }

  // Nightly Cleanup
  static async cleanupExpiredSubscriptions() {
    // 410 Gone means the user revoked permission or the token expired
    // We can delete them entirely to keep the DB clean
    const supabase = getSupabase();
    
    // In a real flow, this is triggered when web-push throws a 410 error.
    // For now, this is a placeholder for where that logic lives.
    console.log('[NotificationEngine] Cleanup job ready');
  }

  private static parseInterval(interval: string): number {
    if (interval === '7 days') return 7 * 24 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
  }
}
