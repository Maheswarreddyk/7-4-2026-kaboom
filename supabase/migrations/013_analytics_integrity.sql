-- Migration 013: Analytics Integrity & RPCs
-- Provides database-level aggregations and idempotency to ensure exact, reproducible dashboard metrics.

-- ==========================================
-- 1. Idempotency & Exactly-Once Semantics
-- ==========================================
ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_events_idempotency ON analytics_events(idempotency_key) WHERE idempotency_key IS NOT NULL;


-- ==========================================
-- 2. Campus Leaderboard RPC
-- ==========================================
CREATE OR REPLACE FUNCTION get_campus_leaderboard(interval_hours INT DEFAULT 24)
RETURNS TABLE (
  campus VARCHAR,
  users BIGINT,
  connections BIGINT,
  mutual_likes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(payload->>'campus', 'Unknown')::VARCHAR AS campus,
    COUNT(DISTINCT session_id) AS users,
    COUNT(*) FILTER (WHERE event_type = 'MATCH_FOUND') AS connections,
    COUNT(*) FILTER (WHERE event_type = 'MUTUAL_LIKE') AS mutual_likes
  FROM analytics_events
  WHERE created_at >= NOW() - (interval_hours || ' hours')::interval
    AND event_type IN ('QUEUE_JOINED', 'MATCH_FOUND', 'MUTUAL_LIKE')
  GROUP BY COALESCE(payload->>'campus', 'Unknown')
  ORDER BY users DESC, connections DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- 3. Search Demand RPC
-- ==========================================
CREATE OR REPLACE FUNCTION get_search_demand(interval_hours INT DEFAULT 24)
RETURNS TABLE (
  campus VARCHAR,
  demand BIGINT,
  supply BIGINT,
  gap BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(payload->>'campus', 'Unknown')::VARCHAR AS campus,
    COUNT(*) FILTER (WHERE event_type = 'QUEUE_JOINED') AS demand,
    COUNT(*) FILTER (WHERE event_type = 'MATCH_FOUND') AS supply,
    GREATEST(0::BIGINT, (COUNT(*) FILTER (WHERE event_type = 'QUEUE_JOINED')) - (COUNT(*) FILTER (WHERE event_type = 'MATCH_FOUND'))) AS gap
  FROM analytics_events
  WHERE created_at >= NOW() - (interval_hours || ' hours')::interval
    AND event_type IN ('QUEUE_JOINED', 'MATCH_FOUND')
  GROUP BY COALESCE(payload->>'campus', 'Unknown')
  ORDER BY demand DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- 4. Match Quality RPC
-- ==========================================
CREATE OR REPLACE FUNCTION get_match_quality(interval_hours INT DEFAULT 24)
RETURNS TABLE (
  mode VARCHAR,
  users BIGINT,
  mutual_like_pct NUMERIC,
  avg_wait_sec NUMERIC,
  avg_duration_min NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT 
      COALESCE(payload->>'matchMode', 'QUICK')::VARCHAR AS match_mode,
      COUNT(*) FILTER (WHERE event_type = 'MATCH_FOUND') * 2 AS users_count,
      COUNT(*) FILTER (WHERE event_type = 'MUTUAL_LIKE') AS likes_count,
      AVG((payload->>'wait_time_sec')::NUMERIC) FILTER (WHERE event_type = 'MATCH_FOUND') AS wait_sec,
      AVG((payload->>'duration_sec')::NUMERIC) / 60.0 FILTER (WHERE event_type = 'CALL_ENDED') AS duration_min
    FROM analytics_events
    WHERE created_at >= NOW() - (interval_hours || ' hours')::interval
      AND event_type IN ('MATCH_FOUND', 'MUTUAL_LIKE', 'CALL_ENDED')
    GROUP BY COALESCE(payload->>'matchMode', 'QUICK')
  )
  SELECT 
    match_mode AS mode,
    users_count AS users,
    CASE WHEN users_count > 0 THEN ROUND((likes_count::NUMERIC / (users_count / 2)::NUMERIC) * 100, 2) ELSE 0::NUMERIC END AS mutual_like_pct,
    COALESCE(ROUND(wait_sec, 2), 0::NUMERIC) AS avg_wait_sec,
    COALESCE(ROUND(duration_min, 2), 0::NUMERIC) AS avg_duration_min
  FROM stats;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- 5. Funnel Analytics RPC
-- ==========================================
CREATE OR REPLACE FUNCTION get_funnel_metrics(interval_hours INT DEFAULT 24)
RETURNS TABLE (
  event_type VARCHAR,
  event_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.event_type::VARCHAR,
    COUNT(a.id) AS event_count
  FROM analytics_events a
  WHERE a.created_at >= NOW() - (interval_hours || ' hours')::interval
    AND a.event_type IN ('SESSION_STARTED', 'QUEUE_JOINED', 'MATCH_FOUND', 'CALL_CONNECTED', 'MUTUAL_LIKE', 'FEEDBACK_SUBMITTED')
  GROUP BY a.event_type;
END;
$$ LANGUAGE plpgsql;
