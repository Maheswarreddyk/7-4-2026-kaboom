-- Migration 009: Analytics V2 (Append-Only Event Store)
-- Provides a dedicated table for historical analytics without impacting production matchmaking tables.

CREATE TYPE analytics_event_type AS ENUM (
  'SESSION_STARTED',
  'SESSION_RESTORED',
  'QUEUE_JOINED',
  'QUEUE_LEFT',
  'QUEUE_TIMEOUT',
  'MATCH_FOUND',
  'MATCH_CANCELLED',
  'CALL_CONNECTED',
  'CALL_RECONNECTED',
  'CALL_FAILED',
  'CALL_ENDED',
  'MUTUAL_LIKE',
  'FILTER_SELECTED',
  'MATCH_MODE_SELECTED',
  'FEEDBACK_SUBMITTED',
  'REPORT_SUBMITTED'
);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type analytics_event_type NOT NULL,
  session_id UUID, -- Deliberately NOT a foreign key to prevent cascade locking/deletion
  match_id UUID,   -- Deliberately NOT a foreign key
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Data Retention Partitioning Strategy (Ready for future pg_partman)
-- Currently utilizing a standard B-Tree index on created_at for pruning.
-- ============================================================
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Deny all public access. Only the backend (service_role) can INSERT and SELECT.
CREATE POLICY "Deny public access to analytics_events"
  ON analytics_events FOR ALL USING (false);

GRANT ALL ON analytics_events TO service_role;
