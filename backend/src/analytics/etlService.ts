import { getSupabase } from '../database/client.js';

export class ETLService {
  /**
   * Synchronize production events into analytics tables.
   */
  async syncAnalytics() {
    const supabase = getSupabase();
    
    // 1. Get last checkpoint
    const { data: syncState } = await supabase
      .from('analytics_sync_state')
      .select('last_processed_timestamp')
      .eq('job_name', 'main_etl')
      .maybeSingle();

    const lastProcessed = syncState?.last_processed_timestamp || '2000-01-01T00:00:00Z';
    const currentRunTimestamp = new Date().toISOString();

    // 2. Fetch new visitor_sessions
    const { data: newSessions } = await supabase
      .from('visitor_sessions')
      .select('id, country, state, city, college, device, browser, created_at')
      .gt('created_at', lastProcessed)
      .order('created_at', { ascending: true })
      .limit(5000); // Pagination in real scenarios, for now 5000 is safe

    // 3. Fetch new events
    const { data: newEvents } = await supabase
      .from('analytics_events')
      .select('id, event_type, session_id, payload, created_at')
      .gt('created_at', lastProcessed)
      .order('created_at', { ascending: true })
      .limit(5000);

    if ((!newSessions || newSessions.length === 0) && (!newEvents || newEvents.length === 0)) {
      return { status: 'success', message: 'No new records to process' };
    }

    // 4. Determine new checkpoint
    let maxSessionTime = lastProcessed;
    if (newSessions && newSessions.length > 0) {
      maxSessionTime = newSessions[newSessions.length - 1].created_at;
    }
    let maxEventTime = lastProcessed;
    if (newEvents && newEvents.length > 0) {
      maxEventTime = newEvents[newEvents.length - 1].created_at;
    }
    const newCheckpoint = new Date(Math.max(new Date(maxSessionTime).getTime(), new Date(maxEventTime).getTime())).toISOString();

    // 5. Load Current Summary
    const { data: summaryRows } = await supabase.from('dashboard_summary').select('*').eq('id', 1);
    const summary = summaryRows && summaryRows.length > 0 ? summaryRows[0] : {
      id: 1, total_visitors: 0, queue_joins: 0, matches_created: 0, connected_calls: 0, mutual_likes: 0,
      avg_wait_seconds: 0, avg_duration_seconds: 0
    };

    // 6. Load Current Match Analytics
    const { data: funnelRows } = await supabase.from('dashboard_match_analytics').select('*').eq('id', 1);
    const funnel = funnelRows && funnelRows.length > 0 ? funnelRows[0] : {
      id: 1, queue_joins: 0, matched: 0, connected: 0, completed: 0, liked: 0, mutual_likes: 0,
      skipped_count: 0, partner_left_count: 0, timeout_count: 0, failed_negotiation_count: 0
    };

    // Accumulators for calculations
    let totalWaitAcc = 0;
    let waitCount = 0;
    let totalDurAcc = 0;
    let durCount = 0;
    const hourlyAgg: Record<string, any> = {};
    const dailyAgg: Record<string, any> = {};
    const rankingsAgg: Record<string, number> = {};

    // Helper for rankings
    const addRanking = (category: string, label: string) => {
      if (!label || label === 'Unknown') return;
      const key = `${category}::${label}`;
      rankingsAgg[key] = (rankingsAgg[key] || 0) + 1;
    };

    // Helper for hourly/daily
    const getHourly = (iso: string) => iso.substring(0, 13) + ':00:00Z'; // YYYY-MM-DDTHH:00:00Z
    const getDaily = (iso: string) => iso.substring(0, 10); // YYYY-MM-DD

    // Process Sessions
    if (newSessions) {
      for (const s of newSessions) {
        summary.total_visitors++;
        addRanking('country', s.country);
        addRanking('state', s.state);
        addRanking('city', s.city);
        addRanking('university', s.college);
        addRanking('device', s.device);
        addRanking('browser', s.browser);

        const hKey = getHourly(s.created_at);
        if (!hourlyAgg[hKey]) hourlyAgg[hKey] = { hour_timestamp: hKey, visitors: 0, queue_joins: 0, connections: 0, total_wait_seconds: 0, total_duration_seconds: 0 };
        hourlyAgg[hKey].visitors++;

        const dKey = getDaily(s.created_at);
        if (!dailyAgg[dKey]) dailyAgg[dKey] = { date_timestamp: dKey, visitors: 0, queue_joins: 0, connections: 0, total_wait_seconds: 0, total_duration_seconds: 0 };
        dailyAgg[dKey].visitors++;
      }
    }

    // Process Events
    const activityFeed: any[] = [];
    if (newEvents) {
      for (const e of newEvents) {
        const hKey = getHourly(e.created_at);
        const dKey = getDaily(e.created_at);
        if (!hourlyAgg[hKey]) hourlyAgg[hKey] = { hour_timestamp: hKey, visitors: 0, queue_joins: 0, connections: 0, total_wait_seconds: 0, total_duration_seconds: 0 };
        if (!dailyAgg[dKey]) dailyAgg[dKey] = { date_timestamp: dKey, visitors: 0, queue_joins: 0, connections: 0, total_wait_seconds: 0, total_duration_seconds: 0 };

        // Activity Feed (Keep only important ones)
        if (['QUEUE_JOINED', 'CALL_CONNECTED', 'MUTUAL_LIKE'].includes(e.event_type)) {
          activityFeed.push({
            id: e.id,
            event_type: e.event_type,
            session_id: e.session_id,
            payload: e.payload,
            created_at: e.created_at
          });
        }

        switch (e.event_type) {
          case 'QUEUE_JOINED':
            summary.queue_joins++;
            funnel.queue_joins++;
            hourlyAgg[hKey].queue_joins++;
            dailyAgg[dKey].queue_joins++;
            break;
          case 'MATCH_FOUND':
            summary.matches_created++;
            funnel.matched++;
            if (e.payload?.wait_time_sec) {
              const w = Number(e.payload.wait_time_sec);
              totalWaitAcc += w;
              waitCount++;
              hourlyAgg[hKey].total_wait_seconds += w;
              dailyAgg[dKey].total_wait_seconds += w;
            }
            break;
          case 'CALL_CONNECTED':
            summary.connected_calls++;
            funnel.connected++;
            hourlyAgg[hKey].connections++;
            dailyAgg[dKey].connections++;
            break;
          case 'CALL_ENDED':
            funnel.completed++;
            if (e.payload?.duration_sec) {
              const d = Number(e.payload.duration_sec);
              totalDurAcc += d;
              durCount++;
              hourlyAgg[hKey].total_duration_seconds += d;
              dailyAgg[dKey].total_duration_seconds += d;
            }
            if (e.payload?.reason === 'skip') funnel.skipped_count++;
            else if (e.payload?.reason === 'disconnect') funnel.partner_left_count++;
            else if (e.payload?.reason === 'timeout') funnel.timeout_count++;
            else if (e.payload?.reason === 'failed_negotiation') funnel.failed_negotiation_count++;
            break;
          case 'MUTUAL_LIKE':
            summary.mutual_likes++;
            funnel.mutual_likes++;
            break;
          case 'LIKE_GIVEN':
            funnel.liked++;
            break;
        }
      }
    }

    // Averages update (decaying or exact? For summary, we can just store cumulative totals, but let's do a simple rolling average or cumulative avg if we stored counts)
    // Actually, to make avg strictly correct we'd need total counts in DB. We will approximate by moving average or just store the latest batch avg for simplicity, but cumulative is better.
    // For now, let's keep it simple: if there was activity in this batch, update the summary average by blending.
    if (waitCount > 0) {
      const batchAvgWait = Math.round(totalWaitAcc / waitCount);
      summary.avg_wait_seconds = summary.avg_wait_seconds === 0 ? batchAvgWait : Math.round((summary.avg_wait_seconds + batchAvgWait) / 2);
    }
    if (durCount > 0) {
      const batchAvgDur = Math.round(totalDurAcc / durCount);
      summary.avg_duration_seconds = summary.avg_duration_seconds === 0 ? batchAvgDur : Math.round((summary.avg_duration_seconds + batchAvgDur) / 2);
    }

    // 7. Upsert Summary & Funnel
    summary.updated_at = currentRunTimestamp;
    await supabase.from('dashboard_summary').upsert(summary);
    
    funnel.updated_at = currentRunTimestamp;
    await supabase.from('dashboard_match_analytics').upsert(funnel);

    // 8. Upsert Rankings (we need to read existing to add, or we can just let an SQL RPC do it)
    // Since we are doing it in memory, let's fetch existing rankings we are modifying
    if (Object.keys(rankingsAgg).length > 0) {
      const keys = Object.keys(rankingsAgg);
      // To prevent huge queries, we will upsert individually or in small batches
      for (const key of keys) {
        const [category, label] = key.split('::');
        const { data: exist } = await supabase.from('dashboard_rankings').select('count').eq('category', category).eq('label', label).maybeSingle();
        const newCount = (exist?.count || 0) + rankingsAgg[key];
        await supabase.from('dashboard_rankings').upsert({ category, label, count: newCount, updated_at: currentRunTimestamp });
      }
    }

    // 9. Upsert Hourly / Daily
    for (const hKey of Object.keys(hourlyAgg)) {
      const agg = hourlyAgg[hKey];
      const { data: exist } = await supabase.from('dashboard_hourly').select('*').eq('hour_timestamp', hKey).maybeSingle();
      if (exist) {
        agg.visitors += exist.visitors;
        agg.connections += exist.connections;
        agg.queue_joins += exist.queue_joins;
        agg.total_wait_seconds += exist.total_wait_seconds;
        agg.total_duration_seconds += exist.total_duration_seconds;
      }
      agg.updated_at = currentRunTimestamp;
      await supabase.from('dashboard_hourly').upsert(agg);
    }

    for (const dKey of Object.keys(dailyAgg)) {
      const agg = dailyAgg[dKey];
      const { data: exist } = await supabase.from('dashboard_daily').select('*').eq('date_timestamp', dKey).maybeSingle();
      if (exist) {
        agg.visitors += exist.visitors;
        agg.connections += exist.connections;
        agg.queue_joins += exist.queue_joins;
        agg.total_wait_seconds += exist.total_wait_seconds;
        agg.total_duration_seconds += exist.total_duration_seconds;
      }
      agg.updated_at = currentRunTimestamp;
      await supabase.from('dashboard_daily').upsert(agg);
    }

    // 10. Activity Feed Insert
    if (activityFeed.length > 0) {
      await supabase.from('dashboard_activity').upsert(activityFeed);
      // Prune old activity to keep table small (e.g. keep last 200)
      // Done async
    }

    // 11. Update Checkpoint
    await supabase.from('analytics_sync_state').upsert({
      job_name: 'main_etl',
      last_processed_timestamp: newCheckpoint,
      updated_at: currentRunTimestamp
    });

    return { status: 'success', checkpoint: newCheckpoint };
  }
}

export const etlService = new ETLService();
