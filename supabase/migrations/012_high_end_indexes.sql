-- Phase 4: High-End Architecture Upgrade - Database Integrity
-- These indexes prevent sequential scans during massive garbage collection
-- and queue matchmaking cycles.

CREATE INDEX IF NOT EXISTS idx_waiting_queue_joined_at
  ON waiting_queue(joined_at ASC);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_seen
  ON visitor_sessions(last_activity DESC)
  WHERE status IN ('waiting', 'matched');

CREATE INDEX IF NOT EXISTS idx_messages_match_id
  ON temporary_messages(match_id, created_at DESC);
