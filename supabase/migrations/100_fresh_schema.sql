-- Kaboom Phase 1 Fresh Schema
-- This replaces all previous migrations and provides a clean, optimized foundation.

-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables if this is run on an existing DB (Optional, but safe for a fresh wipe)
DROP TABLE IF EXISTS connection_logs CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS temporary_messages CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS likes CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS waiting_queue CASCADE;
DROP TABLE IF EXISTS visitor_sessions CASCADE;

-- 3. Core Tables

DROP TYPE IF EXISTS match_mode_type CASCADE;
CREATE TYPE match_mode_type AS ENUM ('RANDOM', 'SMART', 'EXACT');

-- visitor_sessions
CREATE TABLE visitor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token UUID NOT NULL DEFAULT uuid_generate_v4(),
    browser VARCHAR(255),
    device VARCHAR(255),
    platform VARCHAR(255),
    
    -- Profile
    display_name VARCHAR(100),
    bio TEXT,
    gender VARCHAR(20),
    looking_for TEXT[] DEFAULT '{}',
    languages TEXT[] DEFAULT '{}',
    interest_tags TEXT[] DEFAULT '{}',
    
    -- Location
    country VARCHAR(100),
    state VARCHAR(100),
    district VARCHAR(100),
    city VARCHAR(100),
    campus VARCHAR(255),
    
    -- Matchmaking
    match_mode match_mode_type DEFAULT 'RANDOM',
    match_attributes JSONB DEFAULT '{}'::jsonb,
    match_constraints JSONB DEFAULT '{}'::jsonb,
    last_partner UUID,
    status VARCHAR(50) DEFAULT 'CREATED' NOT NULL,
    queue_entered_at TIMESTAMPTZ,
    last_activity TIMESTAMPTZ DEFAULT now(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vs_status_activity ON visitor_sessions(status, last_activity);

-- waiting_queue
CREATE TABLE waiting_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'waiting' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_wq_status_joined ON waiting_queue(status, joined_at);
CREATE UNIQUE INDEX idx_wq_session_waiting ON waiting_queue(session_id) WHERE status = 'waiting';

-- matches
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a UUID NOT NULL REFERENCES visitor_sessions(id),
    user_b UUID NOT NULL REFERENCES visitor_sessions(id),
    match_score INTEGER,
    matched_reason TEXT,
    match_reason_metadata JSONB,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    user_a_ready BOOLEAN DEFAULT false,
    user_b_ready BOOLEAN DEFAULT false,
    negotiation_started BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ
);
CREATE INDEX idx_matches_user_a ON matches(user_a) WHERE ended_at IS NULL;
CREATE INDEX idx_matches_user_b ON matches(user_b) WHERE ended_at IS NULL;

-- reservations
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_a UUID NOT NULL REFERENCES visitor_sessions(id),
    session_b UUID NOT NULL REFERENCES visitor_sessions(id),
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    match_id UUID REFERENCES matches(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolution_reason TEXT
);
CREATE INDEX idx_reservations_pending ON reservations(session_a, session_b) WHERE status = 'pending';

-- 4. Support Tables

-- likes
CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liker_session UUID NOT NULL REFERENCES visitor_sessions(id),
    liked_session UUID NOT NULL REFERENCES visitor_sessions(id),
    match_id UUID NOT NULL REFERENCES matches(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_likes_unique ON likes(liker_session, liked_session, match_id);

-- reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_session UUID NOT NULL REFERENCES visitor_sessions(id),
    reported_session UUID NOT NULL REFERENCES visitor_sessions(id),
    match_id UUID NOT NULL REFERENCES matches(id),
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- feedback
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES visitor_sessions(id),
    match_id UUID REFERENCES matches(id),
    rating INTEGER,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- temporary_messages
CREATE TABLE temporary_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES visitor_sessions(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_temp_messages_match ON temporary_messages(match_id);

-- analytics_events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    session_id UUID,
    match_id UUID,
    payload JSONB,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_analytics_idempotency ON analytics_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- connection_logs
CREATE TABLE connection_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. RPC Functions

-- Reservation Creation
DROP FUNCTION IF EXISTS matchmaker_create_reservation(UUID, UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS matchmaker_create_reservation(UUID, UUID, UUID, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION matchmaker_create_reservation(
  p_session_a UUID,
  p_session_b UUID,
  p_expires_at TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
  v_res_id UUID;
  v_locked_a BOOLEAN;
  v_locked_b BOOLEAN;
BEGIN
  -- 1. Try advisory locks (ordered to prevent deadlock)
  IF p_session_a < p_session_b THEN
    v_locked_a := pg_try_advisory_xact_lock(hashtext(p_session_a::text));
    v_locked_b := pg_try_advisory_xact_lock(hashtext(p_session_b::text));
  ELSE
    v_locked_b := pg_try_advisory_xact_lock(hashtext(p_session_b::text));
    v_locked_a := pg_try_advisory_xact_lock(hashtext(p_session_a::text));
  END IF;

  IF NOT (v_locked_a AND v_locked_b) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Failed to acquire locks');
  END IF;

  -- 2. Verify status is SEARCHING
  IF NOT EXISTS (SELECT 1 FROM visitor_sessions WHERE id = p_session_a AND status = 'SEARCHING') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'User A not SEARCHING');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM visitor_sessions WHERE id = p_session_b AND status = 'SEARCHING') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'User B not SEARCHING');
  END IF;

  -- 3. Verify no pending reservations
  IF EXISTS (
    SELECT 1 FROM reservations 
    WHERE (session_a IN (p_session_a, p_session_b) OR session_b IN (p_session_a, p_session_b))
    AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Pending reservation exists');
  END IF;

  -- 4. Update status to RESERVED
  UPDATE visitor_sessions SET status = 'RESERVED', last_activity = now() WHERE id IN (p_session_a, p_session_b);

  -- 5. Create reservation
  INSERT INTO reservations (session_a, session_b, expires_at)
  VALUES (p_session_a, p_session_b, p_expires_at)
  RETURNING id INTO v_res_id;

  RETURN jsonb_build_object('success', true, 'reservation_id', v_res_id);
END;
$$ LANGUAGE plpgsql;

-- 6. RLS Policies
-- Everything is blocked, accessible only via service role

ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block All" ON visitor_sessions USING (false);
CREATE POLICY "Block All" ON waiting_queue USING (false);
CREATE POLICY "Block All" ON matches USING (false);
CREATE POLICY "Block All" ON reservations USING (false);
CREATE POLICY "Block All" ON likes USING (false);
CREATE POLICY "Block All" ON reports USING (false);
CREATE POLICY "Block All" ON feedback USING (false);
CREATE POLICY "Block All" ON temporary_messages USING (false);
CREATE POLICY "Block All" ON analytics_events USING (false);
CREATE POLICY "Block All" ON connection_logs USING (false);

-- 7. Realtime configuration
-- Drop publication if exists
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- Add tables to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE temporary_messages;
