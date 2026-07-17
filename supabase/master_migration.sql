-- IndiaTV Initial Schema Migration
-- Anonymous Random Video Chat Platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- ENUM TYPES
-- ==========================================

CREATE TYPE session_status AS ENUM ('active', 'waiting', 'matched', 'ended');
CREATE TYPE queue_status AS ENUM ('waiting', 'matched', 'left', 'expired');
CREATE TYPE match_end_reason AS ENUM ('next', 'leave', 'disconnect', 'report', 'timeout', 'error');
CREATE TYPE report_reason AS ENUM ('spam', 'nudity', 'abuse', 'harassment', 'other');
CREATE TYPE connection_event AS ENUM (
  'session_start',
  'session_end',
  'queue_join',
  'queue_leave',
  'match_start',
  'match_end',
  'disconnect',
  'reconnect',
  'next',
  'report',
  'error'
);

-- ==========================================
-- visitor_sessions
-- Stores anonymous visitor session metadata
-- ==========================================

CREATE TABLE visitor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  country VARCHAR(100),
  browser VARCHAR(100),
  device VARCHAR(100),
  platform VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status session_status NOT NULL DEFAULT 'active'
);

COMMENT ON TABLE visitor_sessions IS 'Anonymous visitor sessions without authentication';
COMMENT ON COLUMN visitor_sessions.session_token IS 'Unique token stored in client localStorage';
COMMENT ON COLUMN visitor_sessions.status IS 'Current session lifecycle status';

CREATE INDEX idx_visitor_sessions_token ON visitor_sessions(session_token);
CREATE INDEX idx_visitor_sessions_status ON visitor_sessions(status);
CREATE INDEX idx_visitor_sessions_created_at ON visitor_sessions(created_at DESC);

-- ==========================================
-- waiting_queue
-- Users waiting to be matched
-- ==========================================

CREATE TABLE waiting_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status queue_status NOT NULL DEFAULT 'waiting'
);

COMMENT ON TABLE waiting_queue IS 'Queue of users waiting for random video chat match';
COMMENT ON COLUMN waiting_queue.status IS 'Queue entry status';

CREATE INDEX idx_waiting_queue_session ON waiting_queue(session_id);
CREATE INDEX idx_waiting_queue_status ON waiting_queue(status);
CREATE INDEX idx_waiting_queue_joined_at ON waiting_queue(joined_at);

-- Prevent duplicate active queue entries per session
CREATE UNIQUE INDEX idx_waiting_queue_active_session
  ON waiting_queue(session_id)
  WHERE status = 'waiting';

-- ==========================================
-- matches
-- Paired user connections
-- ==========================================

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  ended_reason match_end_reason,
  CONSTRAINT matches_different_users CHECK (user_a <> user_b)
);

COMMENT ON TABLE matches IS 'Video chat matches between two anonymous users';
COMMENT ON COLUMN matches.duration_seconds IS 'Match duration computed on end';

CREATE INDEX idx_matches_user_a ON matches(user_a);
CREATE INDEX idx_matches_user_b ON matches(user_b);
CREATE INDEX idx_matches_started_at ON matches(started_at DESC);
CREATE INDEX idx_matches_active ON matches(started_at) WHERE ended_at IS NULL;

-- ==========================================
-- reports
-- Abuse reports submitted by users
-- ==========================================

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_session UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  reported_session UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reports_different_users CHECK (reporter_session <> reported_session)
);

COMMENT ON TABLE reports IS 'User-submitted abuse reports';
COMMENT ON COLUMN reports.notes IS 'Optional additional details from reporter';

CREATE INDEX idx_reports_reporter ON reports(reporter_session);
CREATE INDEX idx_reports_reported ON reports(reported_session);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- ==========================================
-- feedback
-- Post-chat feedback and ratings
-- ==========================================

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE feedback IS 'Optional user feedback after chat sessions';
COMMENT ON COLUMN feedback.rating IS 'Rating from 1 to 5 stars';

CREATE INDEX idx_feedback_session ON feedback(session_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- ==========================================
-- server_metrics
-- Periodic server health snapshots
-- ==========================================

CREATE TABLE server_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  active_users INTEGER NOT NULL DEFAULT 0,
  waiting_users INTEGER NOT NULL DEFAULT 0,
  matches_today INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE server_metrics IS 'Periodic snapshots of server activity metrics';

CREATE INDEX idx_server_metrics_timestamp ON server_metrics(timestamp DESC);

-- ==========================================
-- connection_logs
-- Audit trail for connection events
-- ==========================================

CREATE TABLE connection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  event connection_event NOT NULL,
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE connection_logs IS 'Audit log of connection and matching events';
COMMENT ON COLUMN connection_logs.details IS 'Additional event metadata as JSON';

CREATE INDEX idx_connection_logs_session ON connection_logs(session_id);
CREATE INDEX idx_connection_logs_event ON connection_logs(event);
CREATE INDEX idx_connection_logs_timestamp ON connection_logs(timestamp DESC);

-- ==========================================
-- ROW LEVEL SECURITY
-- Backend uses service role (bypasses RLS)
-- Frontend publishable key has read-only stats access
-- ==========================================

ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_logs ENABLE ROW LEVEL SECURITY;

-- Deny all direct client access; backend service role bypasses RLS
CREATE POLICY "Deny public access to visitor_sessions"
  ON visitor_sessions FOR ALL USING (false);

CREATE POLICY "Deny public access to waiting_queue"
  ON waiting_queue FOR ALL USING (false);

CREATE POLICY "Deny public access to matches"
  ON matches FOR ALL USING (false);

CREATE POLICY "Deny public access to reports"
  ON reports FOR ALL USING (false);

CREATE POLICY "Deny public access to feedback"
  ON feedback FOR ALL USING (false);

CREATE POLICY "Allow public read on server_metrics"
  ON server_metrics FOR SELECT USING (true);

CREATE POLICY "Deny public write on server_metrics"
  ON server_metrics FOR INSERT WITH CHECK (false);

CREATE POLICY "Deny public access to connection_logs"
  ON connection_logs FOR ALL USING (false);

-- ==========================================
-- SEED DATA (optional baseline metrics row)
-- ==========================================

INSERT INTO server_metrics (active_users, waiting_users, matches_today)
VALUES (0, 0, 0);

-- ==========================================
-- GRANTS FOR SUPABASE ROLES
-- service_role bypasses RLS but still needs table privileges
-- ==========================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON server_metrics TO anon, authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, service_role;

-- Enable Realtime for broadcast-based matching and WebRTC signaling

-- Realtime is used for session/match broadcast channels (no table replication needed)
-- Ensure Realtime is enabled in Supabase Dashboard: Database → Replication (for future use)

-- Allow anon role to read latest metrics (already in 001, reaffirm)
GRANT SELECT ON server_metrics TO anon, authenticated;

-- Index to speed up active match lookups
CREATE INDEX IF NOT EXISTS idx_matches_active_user_a
  ON matches(user_a) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_matches_active_user_b
  ON matches(user_b) WHERE ended_at IS NULL;

-- Migration 003: IndiaTV MVP Upgrade
-- Adds advanced preferences, weighted matching fields, likes, temporary messages, location/interest tables, etc.

-- 1. Create interests and locations tables for autocomplete
CREATE TABLE IF NOT EXISTS interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('country', 'state', 'district', 'city')),
  country VARCHAR(100),
  state VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100)
);

-- Seed interests
INSERT INTO interests (name, category) VALUES
  ('Gaming', 'General'), ('Movies', 'General'), ('Anime', 'General'), ('Music', 'General'),
  ('Travel', 'General'), ('Photography', 'General'), ('Fitness', 'General'), ('Programming', 'Tech'),
  ('Technology', 'Tech'), ('AI', 'Tech'), ('Business', 'Finance'), ('Finance', 'Finance'),
  ('Books', 'General'), ('Cooking', 'General'), ('Pets', 'General'), ('Football', 'Sports'),
  ('Cricket', 'Sports'), ('Chess', 'Sports'), ('Dating', 'Relationship'), ('Friendship', 'Relationship'),
  ('Cars', 'Lifestyle'), ('Motorcycles', 'Lifestyle'), ('Art', 'General'), ('History', 'General'),
  ('Psychology', 'General'), ('Nature', 'General'), ('Adventure', 'General'), ('Marvel', 'Entertainment'),
  ('DC', 'Entertainment'), ('One Piece', 'Anime'), ('Naruto', 'Anime'), ('Minecraft', 'Gaming'),
  ('Valorant', 'Gaming'), ('PUBG', 'Gaming'), ('BGMI', 'Gaming'), ('Free Fire', 'Gaming'),
  ('Coffee', 'General'), ('Tea', 'General'), ('Camping', 'General'), ('Exploration', 'General'),
  ('Programming Languages', 'Tech'), ('Open Source', 'Tech'), ('Cloud', 'Tech'), ('DevOps', 'Tech'),
  ('Cybersecurity', 'Tech')
ON CONFLICT (name) DO NOTHING;

-- Seed locations
INSERT INTO locations (name, type, country, state, district, city) VALUES
  ('India', 'country', 'India', NULL, NULL, NULL),
  ('United States', 'country', 'United States', NULL, NULL, NULL),
  ('Telangana', 'state', 'India', 'Telangana', NULL, NULL),
  ('Hyderabad', 'city', 'India', 'Telangana', 'Hyderabad', 'Hyderabad'),
  ('California', 'state', 'United States', 'California', NULL, NULL),
  ('Tokyo', 'city', 'Japan', 'Tokyo', NULL, 'Tokyo'),
  ('London', 'city', 'United Kingdom', 'London', NULL, 'London');

-- 2. Modify visitor_sessions to add preference & profile fields
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS looking_for VARCHAR(50)[];
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS languages VARCHAR(100)[];
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS interest_tags VARCHAR(100)[];
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS last_partner UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL;
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ;
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- 3. Modify waiting_queue to add matchmaking attributes
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS score_cache INTEGER DEFAULT 0;
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS preference_hash VARCHAR(255);
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS search_started TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- 4. Modify matches to add scoring and like attributes
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_score INTEGER DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS matched_reason TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS liked_by_a BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS liked_by_b BOOLEAN DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS connection_quality VARCHAR(50);

-- 5. Create likes table
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create temporary_messages table
CREATE TABLE IF NOT EXISTS temporary_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_session UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 7. Modify reports to add category, severity, and reviewed
ALTER TABLE reports ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS severity VARCHAR(50);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reviewed BOOLEAN DEFAULT FALSE;

-- 8. Row Level Security policies (matches initial migration pattern)
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on interests" ON interests FOR SELECT USING (true);
CREATE POLICY "Allow public read on locations" ON locations FOR SELECT USING (true);

CREATE POLICY "Deny public access to likes" ON likes FOR ALL USING (false);
CREATE POLICY "Deny public access to temporary_messages" ON temporary_messages FOR ALL USING (false);

-- Grants
GRANT SELECT ON interests TO anon, authenticated;
GRANT SELECT ON locations TO anon, authenticated;
GRANT ALL ON interests TO service_role;
GRANT ALL ON locations TO service_role;
GRANT ALL ON likes TO service_role;
GRANT ALL ON temporary_messages TO service_role;

-- Migration 004: Fix likes table unique constraint
-- The code expects a UNIQUE constraint on (match_id, session_id) to prevent duplicate likes,
-- catching error code 23505 for duplicate handling. But the constraint was never defined.

ALTER TABLE likes ADD CONSTRAINT likes_match_session_unique UNIQUE (match_id, session_id);

-- Migration 005: Matchmaking engines — idempotent queue, reservations, READY state

-- Queue heartbeat (preserve joined_at, update last_seen only)
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS queue_position INTEGER;

UPDATE waiting_queue SET last_seen = joined_at WHERE last_seen IS NULL;

CREATE INDEX IF NOT EXISTS idx_waiting_queue_last_seen ON waiting_queue(last_seen)
  WHERE status = 'waiting';

-- Match READY / negotiation gate
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_a_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_b_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS negotiation_started BOOLEAN NOT NULL DEFAULT FALSE;

-- Atomic reservations (5 second timeout)
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiator_session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  partner_session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'expired', 'rolled_back')),
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT reservations_different_users CHECK (initiator_session_id <> partner_session_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_initiator
  ON reservations(initiator_session_id) WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_partner
  ON reservations(partner_session_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reservations_expires_at
  ON reservations(expires_at) WHERE status = 'pending';

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public access to reservations" ON reservations FOR ALL USING (false);
GRANT ALL ON reservations TO service_role;

-- Extend connection event enum for engine logging
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_created';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_confirmed';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_expired';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'negotiation_start';

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

-- Migration 008: V6 Identity and University Constraint Matching
-- Adds temporary profile metadata, match mode policies, attributes, and reason caches
-- This is backward-compatible and additive only

-- 1. Create MATCH_MODE enum type if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_mode_type') THEN
    CREATE TYPE match_mode_type AS ENUM ('RANDOM', 'PREFER', 'STRICT');
  END IF;
END$$;

-- 2. Add columns to visitor_sessions table
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS display_name VARCHAR(50) DEFAULT 'Guest';
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS bio VARCHAR(150);
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS match_mode match_mode_type DEFAULT 'RANDOM';
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS match_constraints JSONB DEFAULT '{}'::jsonb;
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS match_attributes JSONB DEFAULT '{}'::jsonb;

-- 3. Add columns to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_reason_metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Create optimized index for strict matchmaking passes
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_strict_attributes
  ON visitor_sessions(match_mode)
  WHERE status = 'waiting';

-- 5. Grant permissions to service_role
GRANT ALL ON visitor_sessions TO service_role;
GRANT ALL ON matches TO service_role;

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

-- Migration 011: Push Notifications Infrastructure
-- Creates tables for storing push subscriptions and caching user preferences 
-- independent of ephemeral visitor sessions.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  subscription_json JSONB NOT NULL,
  browser VARCHAR(50),
  os VARCHAR(50),
  device_type VARCHAR(20),
  enabled BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subscription_json)
);

CREATE TABLE IF NOT EXISTS user_preferences_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  gender VARCHAR(20),
  looking_for VARCHAR(20),
  college VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255),
  languages JSONB DEFAULT '[]'::jsonb,
  interests JSONB DEFAULT '[]'::jsonb,
  match_mode VARCHAR(20) DEFAULT 'SMART',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deny public access to these tables. Backend only.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public access to push_subscriptions" ON push_subscriptions FOR ALL USING (false);
GRANT ALL ON push_subscriptions TO service_role;

ALTER TABLE user_preferences_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public access to user_preferences_cache" ON user_preferences_cache FOR ALL USING (false);
GRANT ALL ON user_preferences_cache TO service_role;

-- GIN Indexes for Audience Segmentation Targeting
CREATE INDEX IF NOT EXISTS idx_push_subs_enabled ON push_subscriptions(enabled);
CREATE INDEX IF NOT EXISTS idx_push_subs_last_seen ON push_subscriptions(last_seen);
CREATE INDEX IF NOT EXISTS idx_pref_cache_college ON user_preferences_cache(college);
CREATE INDEX IF NOT EXISTS idx_pref_cache_city ON user_preferences_cache(city);
CREATE INDEX IF NOT EXISTS idx_pref_cache_interests_gin ON user_preferences_cache USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_pref_cache_languages_gin ON user_preferences_cache USING GIN (languages);

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
      AVG((payload->>'duration_sec')::NUMERIC) FILTER (WHERE event_type = 'CALL_ENDED') / 60.0 AS duration_min
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

ALTER TYPE match_end_reason ADD VALUE IF NOT EXISTS 'client_aborted_match';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'client_aborted_match';

-- Migration: 015_sync_audit_media_ready.sql
-- Description: Add strict bidirectional media verification flags to matches table and sequence numbering support to connection logs.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS user_a_media_ready BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS user_b_media_ready BOOLEAN DEFAULT FALSE;

ALTER TABLE connection_logs
  ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_num BIGINT,
  ADD COLUMN IF NOT EXISTS prev_state TEXT,
  ADD COLUMN IF NOT EXISTS new_state TEXT;

-- Phase 1: DB-002 Add Missing Foreign Key Indexes
-- These indexes prevent O(N) sequential scans when deleting parent rows.

CREATE INDEX IF NOT EXISTS idx_temporary_messages_match_id ON temporary_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_temporary_messages_sender_session ON temporary_messages(sender_session);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_last_partner ON visitor_sessions(last_partner);

CREATE INDEX IF NOT EXISTS idx_reservations_match_id ON reservations(match_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_session_id ON push_subscriptions(session_id);

CREATE INDEX IF NOT EXISTS idx_user_preferences_cache_subscription_id ON user_preferences_cache(subscription_id);

CREATE INDEX IF NOT EXISTS idx_connection_logs_match_id ON connection_logs(match_id);

CREATE INDEX IF NOT EXISTS idx_likes_session_id ON likes(session_id);

-- Phase 1: DB-003 Fix Advisory Lock Scope (PgBouncer Deadlock)
-- Replace generic session locks with transaction-bound locks and wrap mutations in RPCs.

-- 1. Drop the unsafe session lock functions
DROP FUNCTION IF EXISTS try_advisory_lock(bigint);
DROP FUNCTION IF EXISTS advisory_unlock(bigint);

-- 2. Create the atomic Reservation RPC
CREATE OR REPLACE FUNCTION matchmaker_create_reservation(
  p_initiator_id uuid,
  p_partner_id uuid,
  p_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_a record;
  v_lock_b record;
  v_reservation_id uuid;
BEGIN
  -- Acquire the global transaction lock for matchmaking (ID 8888)
  IF NOT pg_try_advisory_xact_lock(8888) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'lock_contention');
  END IF;

  -- Atomic pre-lock: Transition both users to RESERVED if they are SEARCHING
  UPDATE visitor_sessions 
  SET status = 'RESERVED' 
  WHERE id = p_initiator_id AND status = 'SEARCHING'
  RETURNING id INTO v_lock_a;

  UPDATE visitor_sessions 
  SET status = 'RESERVED' 
  WHERE id = p_partner_id AND status = 'SEARCHING'
  RETURNING id INTO v_lock_b;

  -- If either lock failed, rollback and return
  IF v_lock_a IS NULL OR v_lock_b IS NULL THEN
    IF v_lock_a IS NOT NULL THEN
      UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id = p_initiator_id;
    END IF;
    IF v_lock_b IS NOT NULL THEN
      UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id = p_partner_id;
    END IF;
    RETURN jsonb_build_object('success', false, 'reason', 'Session already reserved');
  END IF;

  -- Both locked successfully, create the reservation
  INSERT INTO reservations (
    user_a, 
    user_b, 
    initiator_session_id, 
    partner_session_id, 
    status, 
    expires_at
  ) VALUES (
    p_initiator_id,
    p_partner_id,
    p_initiator_id,
    p_partner_id,
    'pending',
    p_expires_at
  ) RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object('success', true, 'reservationId', v_reservation_id);
EXCEPTION
  WHEN unique_violation THEN
    -- Rollback session states
    UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id IN (p_initiator_id, p_partner_id);
    RETURN jsonb_build_object('success', false, 'reason', 'Session already reserved (constraint)');
  WHEN OTHERS THEN
    UPDATE visitor_sessions SET status = 'SEARCHING' WHERE id IN (p_initiator_id, p_partner_id);
    RETURN jsonb_build_object('success', false, 'reason', SQLERRM);
END;
$$;

-- Migration 018: Distributed Heal Cycle RPC
-- Consolidates queue and reservation healing logic into a single, atomic database transaction.

CREATE OR REPLACE FUNCTION matchmaker_heal_cycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    now_ts timestamp with time zone := now();
    affected_sessions uuid[];
BEGIN
    -- 1. Expire stale reservations
    -- Find all reservations that have expired and are still pending
    WITH expired_resvs AS (
        UPDATE reservations
        SET status = 'rolled_back'
        WHERE status = 'pending' AND expires_at < now_ts
        RETURNING initiator_session_id, partner_session_id
    )
    SELECT array_agg(DISTINCT u.id) INTO affected_sessions
    FROM (
        SELECT initiator_session_id FROM expired_resvs WHERE initiator_session_id IS NOT NULL
        UNION
        SELECT partner_session_id FROM expired_resvs WHERE partner_session_id IS NOT NULL
    ) u;

    -- Recover sessions from expired reservations
    IF array_length(affected_sessions, 1) > 0 THEN
        UPDATE visitor_sessions
        SET status = 'SEARCHING', last_activity = now_ts
        WHERE id = ANY(affected_sessions);

        UPDATE waiting_queue
        SET status = 'waiting', last_seen = now_ts
        WHERE session_id = ANY(affected_sessions) AND status = 'matched';
    END IF;

    -- 2. Recover orphaned RESERVED sessions
    -- Find sessions in RESERVED state without any active reservation
    WITH orphaned AS (
        SELECT v.id
        FROM visitor_sessions v
        LEFT JOIN reservations r ON 
            (r.initiator_session_id = v.id OR r.partner_session_id = v.id)
            AND r.status = 'pending'
        WHERE v.status = 'RESERVED' AND r.id IS NULL
    )
    UPDATE visitor_sessions
    SET status = 'SEARCHING', last_activity = now_ts
    WHERE id IN (SELECT id FROM orphaned);

    -- Ensure orphaned sessions are marked as waiting in the queue
    WITH orphaned AS (
        SELECT v.id
        FROM visitor_sessions v
        LEFT JOIN reservations r ON 
            (r.initiator_session_id = v.id OR r.partner_session_id = v.id)
            AND r.status = 'pending'
        WHERE v.status = 'RESERVED' AND r.id IS NULL
    )
    UPDATE waiting_queue
    SET status = 'waiting', last_seen = now_ts
    WHERE session_id IN (SELECT id FROM orphaned) AND status = 'matched';

END;
$$;

-- Migration 019: Secure JSON Index (DB-004)
-- Replaces direct UNIQUE constraint on JSONB with MD5 hash of endpoint to avoid Postgres B-Tree size limits

ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_subscription_json_key;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx 
ON push_subscriptions ((md5(subscription_json->>'endpoint')));

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

 
 
-- ==========================================
-- matchmaker_metrics
-- Persistent global metrics for the matchmaking engine
-- ==========================================

CREATE TABLE matchmaker_metrics (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_searching_users INTEGER NOT NULL DEFAULT 0,
  average_wait_time NUMERIC(10, 2) NOT NULL DEFAULT 0,
  maximum_wait_time NUMERIC(10, 2) NOT NULL DEFAULT 0,
  successful_matches BIGINT NOT NULL DEFAULT 0,
  failed_matches BIGINT NOT NULL DEFAULT 0,
  rematches BIGINT NOT NULL DEFAULT 0,
  abandoned_searches BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT single_row CHECK (id = 1)
);

COMMENT ON TABLE matchmaker_metrics IS 'Singleton table storing persistent matchmaker metrics';

INSERT INTO matchmaker_metrics (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE matchmaker_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on matchmaker_metrics" ON matchmaker_metrics FOR SELECT USING (true);
CREATE POLICY "Deny public write on matchmaker_metrics" ON matchmaker_metrics FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny public update on matchmaker_metrics" ON matchmaker_metrics FOR UPDATE USING (false);
GRANT ALL ON matchmaker_metrics TO service_role;
GRANT SELECT ON matchmaker_metrics TO anon, authenticated;

-- Add helper RPC to update matchmaker metrics atomically
CREATE OR REPLACE FUNCTION update_matchmaker_metrics(
  p_total_searching_users INTEGER,
  p_avg_wait NUMERIC,
  p_max_wait NUMERIC,
  p_succ BIGINT,
  p_fail BIGINT,
  p_rematches BIGINT,
  p_abandoned BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE matchmaker_metrics SET
    total_searching_users = p_total_searching_users,
    average_wait_time = average_wait_time + p_avg_wait,
    maximum_wait_time = GREATEST(maximum_wait_time, p_max_wait),
    successful_matches = successful_matches + p_succ,
    failed_matches = failed_matches + p_fail,
    rematches = rematches + p_rematches,
    abandoned_searches = abandoned_searches + p_abandoned
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION update_matchmaker_metrics TO service_role;
