-- KABOOM MASTER SQL FOR PRODUCTION
-- Unified Schema (No fragmentation, NO ALTER TABLES)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM TYPES
CREATE TYPE session_status AS ENUM ('active', 'waiting', 'matched', 'ended');
CREATE TYPE queue_status AS ENUM ('waiting', 'matched', 'left', 'expired');
CREATE TYPE match_end_reason AS ENUM ('next', 'leave', 'disconnect', 'report', 'timeout', 'error', 'client_aborted_match');
CREATE TYPE report_reason AS ENUM ('spam', 'nudity', 'abuse', 'harassment', 'other');
CREATE TYPE connection_event AS ENUM (
  'session_start', 'session_end', 'queue_join', 'queue_leave',
  'match_start', 'match_end', 'disconnect', 'reconnect', 'next', 'report', 'error', 'client_aborted_match'
);
CREATE TYPE match_mode_type AS ENUM ('RANDOM', 'PREFER', 'STRICT');

-- VISITOR SESSIONS
CREATE TABLE visitor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token VARCHAR(255) NOT NULL UNIQUE,
  country VARCHAR(100),
  browser VARCHAR(100),
  device VARCHAR(100),
  platform VARCHAR(100),
  
  gender VARCHAR(50),
  looking_for VARCHAR(50)[],
  languages VARCHAR(100)[],
  state VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  interest_tags VARCHAR(100)[],
  
  display_name VARCHAR(50) DEFAULT 'Guest',
  bio VARCHAR(150),
  match_mode match_mode_type DEFAULT 'RANDOM',
  match_constraints JSONB DEFAULT '{}'::jsonb,
  match_attributes JSONB DEFAULT '{}'::jsonb,
  
  last_partner UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  queue_entered_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'READY'
);

CREATE INDEX idx_visitor_sessions_token ON visitor_sessions(session_token);
CREATE INDEX idx_visitor_sessions_status ON visitor_sessions(status);
CREATE INDEX idx_visitor_sessions_created_at ON visitor_sessions(created_at DESC);

-- WAITING QUEUE
CREATE TABLE waiting_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status queue_status NOT NULL DEFAULT 'waiting'
);
CREATE INDEX idx_waiting_queue_session ON waiting_queue(session_id);
CREATE INDEX idx_waiting_queue_status ON waiting_queue(status);
CREATE INDEX idx_waiting_queue_joined_at ON waiting_queue(joined_at);
CREATE UNIQUE INDEX idx_waiting_queue_active_session ON waiting_queue(session_id) WHERE status = 'waiting';

-- MATCHES
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
CREATE INDEX idx_matches_user_a ON matches(user_a);
CREATE INDEX idx_matches_user_b ON matches(user_b);
CREATE INDEX idx_matches_started_at ON matches(started_at DESC);
CREATE INDEX idx_matches_active ON matches(started_at) WHERE ended_at IS NULL;

-- TEMPORARY MESSAGES
CREATE TABLE temporary_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_temp_messages_match ON temporary_messages(match_id);

-- RESERVATIONS
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reservations_match ON reservations(match_id);
CREATE INDEX idx_reservations_session ON reservations(session_id);
CREATE UNIQUE INDEX idx_reservations_unique ON reservations(match_id, session_id);

-- REPORTS
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_session UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  reported_session UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  reason report_reason NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reports_different_users CHECK (reporter_session <> reported_session)
);
CREATE INDEX idx_reports_reporter ON reports(reporter_session);
CREATE INDEX idx_reports_reported ON reports(reported_session);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- FEEDBACK
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feedback_session ON feedback(session_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- SERVER METRICS
CREATE TABLE server_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  active_users INTEGER NOT NULL DEFAULT 0,
  waiting_users INTEGER NOT NULL DEFAULT 0,
  matches_today INTEGER NOT NULL DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_server_metrics_timestamp ON server_metrics(timestamp DESC);

-- CONNECTION LOGS
CREATE TABLE connection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  event connection_event NOT NULL,
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_connection_logs_session ON connection_logs(session_id);
CREATE INDEX idx_connection_logs_match_id ON connection_logs(match_id);
CREATE INDEX idx_connection_logs_event ON connection_logs(event);
CREATE INDEX idx_connection_logs_timestamp ON connection_logs(timestamp DESC);

-- DASHBOARD SUMMARY
CREATE TABLE dashboard_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  total_sessions INTEGER DEFAULT 0,
  total_matches INTEGER DEFAULT 0,
  total_reports INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_dashboard_date ON dashboard_summary(date);

-- ANALYTICS EVENTS
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);

-- PUSH SUBSCRIPTIONS
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES visitor_sessions(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL UNIQUE,
  subscription_json JSONB NOT NULL,
  browser VARCHAR(50),
  os VARCHAR(50),
  device_type VARCHAR(20),
  enabled BOOLEAN DEFAULT true,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_push_subs_enabled ON push_subscriptions(enabled);
CREATE INDEX idx_push_subs_last_seen ON push_subscriptions(last_seen);
CREATE INDEX idx_push_subscriptions_session_id ON push_subscriptions(session_id);

-- USER PREFERENCES CACHE
CREATE TABLE user_preferences_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID UNIQUE REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  display_name VARCHAR(100),
  gender VARCHAR(20),
  looking_for JSONB,
  college VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255),
  languages JSONB DEFAULT '[]'::jsonb,
  interests JSONB DEFAULT '[]'::jsonb,
  match_mode VARCHAR(20) DEFAULT 'SMART',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pref_cache_college ON user_preferences_cache(college);
CREATE INDEX idx_pref_cache_city ON user_preferences_cache(city);
CREATE INDEX idx_pref_cache_interests_gin ON user_preferences_cache USING GIN (interests);
CREATE INDEX idx_pref_cache_languages_gin ON user_preferences_cache USING GIN (languages);

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporary_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny public access" ON visitor_sessions FOR ALL USING (false);
CREATE POLICY "Deny public access" ON waiting_queue FOR ALL USING (false);
CREATE POLICY "Deny public access" ON matches FOR ALL USING (false);
CREATE POLICY "Deny public access" ON temporary_messages FOR ALL USING (false);
CREATE POLICY "Deny public access" ON reservations FOR ALL USING (false);
CREATE POLICY "Deny public access" ON reports FOR ALL USING (false);
CREATE POLICY "Deny public access" ON feedback FOR ALL USING (false);
CREATE POLICY "Deny public access" ON connection_logs FOR ALL USING (false);
CREATE POLICY "Deny public access" ON dashboard_summary FOR ALL USING (false);
CREATE POLICY "Deny public access" ON analytics_events FOR ALL USING (false);
CREATE POLICY "Deny public access" ON push_subscriptions FOR ALL USING (false);
CREATE POLICY "Deny public access" ON user_preferences_cache FOR ALL USING (false);

-- Grant select to anon for server metrics only
CREATE POLICY "Allow anon select metrics" ON server_metrics FOR SELECT USING (true);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboard_summary_modtime
BEFORE UPDATE ON dashboard_summary
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_push_subscriptions_modtime
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_user_preferences_cache_modtime
BEFORE UPDATE ON user_preferences_cache
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
