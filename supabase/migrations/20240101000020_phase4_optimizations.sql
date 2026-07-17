-- Migration 020: Phase 4 Optimizations & Cleanup (DB-005, DB-007, DB-006)

-- [DB-005] Analytics Composite Index
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created_at
  ON analytics_events(event_type, created_at DESC);

-- [DB-006] Remove Duplicate Index
-- The UNIQUE constraint on session_token automatically creates a unique index, 
-- making the secondary index redundant and costly on INSERTs.
DROP INDEX IF EXISTS idx_visitor_sessions_token;

-- [DB-007] Ephemeral Message Cleanup
-- Add index on expires_at for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_temporary_messages_expires_at
  ON temporary_messages(expires_at);

-- Implement pg_cron TTL for ephemeral messages (requires pg_cron extension)
-- If pg_cron is enabled, this will schedule a daily job to delete expired messages.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup_ephemeral_messages',
      '0 3 * * *', -- Run every day at 3:00 AM
      'DELETE FROM temporary_messages WHERE expires_at < NOW()'
    );
  END IF;
END$$;
