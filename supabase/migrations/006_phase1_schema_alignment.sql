-- Migration 006: Phase 1 — Schema alignment & infrastructure hardening
-- Aligns code expectations with the columns created in 005_v2_engine_upgrade.sql
-- Additive only — no columns removed, no data lost
-- Apply this in Supabase SQL Editor before deploying the Phase 1 backend build

-- ============================================================
-- 1. RESERVATIONS TABLE — add alias columns for code compat
--    The existing table has user_a / user_b (from 005).
--    The backend code references initiator_session_id / partner_session_id.
--    We add the alias columns and populate them from existing data.
-- ============================================================
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS initiator_session_id UUID REFERENCES visitor_sessions(id) ON DELETE CASCADE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS partner_session_id   UUID REFERENCES visitor_sessions(id) ON DELETE CASCADE;

-- Backfill existing rows so indexes work immediately
UPDATE reservations
SET initiator_session_id = user_a,
    partner_session_id   = user_b
WHERE initiator_session_id IS NULL;

-- Partial unique indexes to enforce one pending reservation per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_initiator
  ON reservations(initiator_session_id) WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_partner
  ON reservations(partner_session_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reservations_expires_at
  ON reservations(expires_at) WHERE status = 'pending';

-- ============================================================
-- 2. MATCHES TABLE — add alias columns for code compat
--    005 added ready_a / ready_b / lifecycle.
--    Code references user_a_ready / user_b_ready / negotiation_started.
-- ============================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_a_ready        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_b_ready        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS negotiation_started BOOLEAN NOT NULL DEFAULT FALSE;

-- Sync existing data from 005 columns if any matches already exist
UPDATE matches
SET user_a_ready = COALESCE(ready_a, FALSE),
    user_b_ready = COALESCE(ready_b, FALSE)
WHERE user_a_ready = FALSE AND user_b_ready = FALSE;

-- ============================================================
-- 3. VISITOR_SESSIONS — heartbeat & queue tracking improvements
-- ============================================================

-- Ensure last_activity exists and has a default (may already exist from 003)
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ;

-- Composite index for heartbeat-based queue filtering
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_heartbeat
  ON visitor_sessions(last_activity DESC)
  WHERE status IN ('waiting', 'matched');

-- ============================================================
-- 4. WAITING_QUEUE — last_seen heartbeat column
-- ============================================================
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE waiting_queue SET last_seen = joined_at WHERE last_seen IS NULL;

CREATE INDEX IF NOT EXISTS idx_waiting_queue_last_seen
  ON waiting_queue(last_seen DESC)
  WHERE status = 'waiting';

-- ============================================================
-- 5. LIKES TABLE — unique constraint to prevent double-likes
--    (already added by 004 as idx_likes_match_session — no-op if exists)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_unique_match_session
  ON likes(match_id, session_id);

-- ============================================================
-- 6. Extend connection_event enum for Phase 1 engine logging
--    (if not already added by 005)
-- ============================================================
DO $$
BEGIN
  BEGIN ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_created'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_confirmed'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_expired'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'ready'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'negotiation_start'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'match_start'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;

-- ============================================================
-- 7. Grants for any new columns/tables
-- ============================================================
GRANT ALL ON reservations TO service_role;
