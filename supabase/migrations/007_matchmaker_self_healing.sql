-- Migration 007: Matchmaker Self-Healing and Advisory Locking
-- Alters visitor_sessions.status from ENUM to VARCHAR to allow explicit FSM states
-- Creates Postgres advisory locking wrappers for distributed matchmaking passes

-- 1. Drop all dependent indexes referencing status to avoid type comparison mismatches
DROP INDEX IF EXISTS idx_visitor_sessions_status;
DROP INDEX IF EXISTS idx_visitor_sessions_heartbeat;
DROP INDEX IF EXISTS idx_visitor_sessions_last_activity;

-- 2. Drop the default constraint of visitor_sessions.status
ALTER TABLE visitor_sessions ALTER COLUMN status DROP DEFAULT;

-- 3. Alter status column type using explicit cast
ALTER TABLE visitor_sessions ALTER COLUMN status TYPE VARCHAR(50) USING status::text;

-- 4. Set new FSM default value
ALTER TABLE visitor_sessions ALTER COLUMN status SET DEFAULT 'READY';

-- 5. Re-create indexes using new VARCHAR type rules
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_status ON visitor_sessions(status);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_heartbeat
  ON visitor_sessions(last_activity DESC)
  WHERE status IN ('waiting', 'matched', 'SEARCHING');

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_activity
  ON visitor_sessions(last_activity DESC)
  WHERE status IN ('READY', 'SEARCHING', 'RESERVED', 'MATCHED', 'SIGNALING', 'CONNECTED', 'PARTNER_LEFT', 'REQUEUEING');

-- 6. Create try_advisory_lock RPC function
CREATE OR REPLACE FUNCTION try_advisory_lock(lock_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN pg_try_advisory_lock(lock_id);
END;
$$ LANGUAGE plpgsql;

-- 7. Create advisory_unlock RPC function
CREATE OR REPLACE FUNCTION advisory_unlock(lock_id bigint)
RETURNS boolean AS $$
BEGIN
  RETURN pg_advisory_unlock(lock_id);
END;
$$ LANGUAGE plpgsql;

-- 8. Expose functions to API
GRANT EXECUTE ON FUNCTION try_advisory_lock(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION advisory_unlock(bigint) TO service_role;
