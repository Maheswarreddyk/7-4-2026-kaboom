-- Migration 010: Analytics Enhancements
-- Creates the daily snapshot table for high-performance dashboard scaling
-- Creates GIN indexes on the analytics_events JSONB payload

CREATE TABLE IF NOT EXISTS analytics_daily_snapshots (
  date DATE PRIMARY KEY,
  total_users INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  total_mutual_likes INTEGER DEFAULT 0,
  avg_wait_time_seconds NUMERIC(10, 2) DEFAULT 0,
  avg_match_duration_seconds NUMERIC(10, 2) DEFAULT 0,
  platform_health_score NUMERIC(5, 2) DEFAULT 100,
  metrics_json JSONB DEFAULT '{}'::jsonb, -- Store dynamic counts like top campuses
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deny public access to snapshots. Backend only.
ALTER TABLE analytics_daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public access to analytics_daily_snapshots" ON analytics_daily_snapshots FOR ALL USING (false);
GRANT ALL ON analytics_daily_snapshots TO service_role;

-- GIN Index for fast JSONB querying (crucial for filtering by campus/city/match_mode)
CREATE INDEX IF NOT EXISTS idx_analytics_events_payload_gin ON analytics_events USING GIN (payload);
