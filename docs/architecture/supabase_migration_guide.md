# Supabase Migration & Architecture Guide

This document outlines everything your new Supabase account needs to perfectly support the current Kaboom TV Frontend and Backend.

## 1. Complete Database Schema (The "Source of Truth")

The previous `100_fresh_schema.sql` was missing tables for analytics, dashboards, metrics, and the new client metadata columns (`browser`, `device`, `platform`).

I have compiled the **100% Complete SQL Schema** below. When you create your new Supabase project, go to the **SQL Editor**, paste this entirely, and hit Run.

```sql
-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Core Tables
CREATE TABLE visitor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_token UUID NOT NULL DEFAULT uuid_generate_v4(),
    display_name VARCHAR(100), bio TEXT, gender VARCHAR(20),
    looking_for TEXT[] DEFAULT '{}', languages TEXT[] DEFAULT '{}', interest_tags TEXT[] DEFAULT '{}',
    country VARCHAR(100), state VARCHAR(100), district VARCHAR(100), city VARCHAR(100), campus VARCHAR(255),
    browser VARCHAR(100), device VARCHAR(50), platform VARCHAR(50), -- Recently Added
    match_mode VARCHAR(20) DEFAULT 'RANDOM', match_attributes JSONB DEFAULT '{}'::jsonb, match_constraints JSONB DEFAULT '{}'::jsonb,
    last_partner UUID, status VARCHAR(50) DEFAULT 'CREATED' NOT NULL, queue_entered_at TIMESTAMPTZ, last_activity TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vs_status_activity ON visitor_sessions(status, last_activity);

CREATE TABLE waiting_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'waiting' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT now(), last_seen TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_wq_status_joined ON waiting_queue(status, joined_at);
CREATE UNIQUE INDEX idx_wq_session_waiting ON waiting_queue(session_id) WHERE status = 'waiting';

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_a UUID NOT NULL REFERENCES visitor_sessions(id), user_b UUID NOT NULL REFERENCES visitor_sessions(id),
    match_score INTEGER, matched_reason TEXT, match_reason_metadata JSONB,
    user_a_ready BOOLEAN DEFAULT false, user_b_ready BOOLEAN DEFAULT false, negotiation_started BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ DEFAULT now(), ended_at TIMESTAMPTZ
);
CREATE INDEX idx_matches_user_a ON matches(user_a) WHERE ended_at IS NULL;
CREATE INDEX idx_matches_user_b ON matches(user_b) WHERE ended_at IS NULL;

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_a UUID NOT NULL REFERENCES visitor_sessions(id), session_b UUID NOT NULL REFERENCES visitor_sessions(id),
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, match_id UUID REFERENCES matches(id),
    created_at TIMESTAMPTZ DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, resolved_at TIMESTAMPTZ, resolution_reason TEXT
);
CREATE INDEX idx_reservations_pending ON reservations(session_a, session_b) WHERE status = 'pending';

-- 3. Communication & Moderation Tables
CREATE TABLE temporary_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE, sender_id UUID NOT NULL REFERENCES visitor_sessions(id),
    content TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_temp_messages_match ON temporary_messages(match_id);

CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liker_session UUID NOT NULL REFERENCES visitor_sessions(id), liked_session UUID NOT NULL REFERENCES visitor_sessions(id),
    match_id UUID NOT NULL REFERENCES matches(id), created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_likes_unique ON likes(liker_session, liked_session, match_id);

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_session UUID NOT NULL REFERENCES visitor_sessions(id), reported_session UUID NOT NULL REFERENCES visitor_sessions(id),
    match_id UUID NOT NULL REFERENCES matches(id), reason TEXT NOT NULL, details TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES visitor_sessions(id), match_id UUID REFERENCES matches(id),
    rating INTEGER, comments TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE connection_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL, event_type VARCHAR(50) NOT NULL, details JSONB, created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Analytics & Metrics Tables (Previously missing from fresh install)
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL, session_id UUID, match_id UUID, payload JSONB, idempotency_key VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_analytics_idempotency ON analytics_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE server_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    active_users INTEGER DEFAULT 0, waiting_users INTEGER DEFAULT 0, matches_today INTEGER DEFAULT 0, timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE matchmaker_metrics (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_searching_users INTEGER DEFAULT 0, average_wait_time NUMERIC DEFAULT 0, maximum_wait_time NUMERIC DEFAULT 0,
    successful_matches INTEGER DEFAULT 0, failed_matches INTEGER DEFAULT 0, rematches INTEGER DEFAULT 0, abandoned_searches INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO matchmaker_metrics (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE analytics_sync_state (
    id INTEGER PRIMARY KEY DEFAULT 1, last_processed_id UUID, updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO analytics_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE dashboard_summary (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_users INTEGER DEFAULT 0, active_users INTEGER DEFAULT 0, total_matches INTEGER DEFAULT 0,
    successful_matches INTEGER DEFAULT 0, match_success_rate NUMERIC DEFAULT 0, avg_wait_time NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO dashboard_summary (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE dashboard_match_analytics (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_queue_joins INTEGER DEFAULT 0, total_matches_found INTEGER DEFAULT 0, total_matches_accepted INTEGER DEFAULT 0,
    total_matches_declined INTEGER DEFAULT 0, total_matches_ignored INTEGER DEFAULT 0, total_conversations_started INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO dashboard_match_analytics (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE dashboard_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(50), label VARCHAR(100), count INTEGER DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX idx_dash_rankings_cat_label ON dashboard_rankings(category, label);

CREATE TABLE dashboard_hourly (
    hour_timestamp TIMESTAMP PRIMARY KEY, active_users INTEGER DEFAULT 0, matches_created INTEGER DEFAULT 0, messages_sent INTEGER DEFAULT 0
);

CREATE TABLE dashboard_daily (
    date_timestamp DATE PRIMARY KEY, active_users INTEGER DEFAULT 0, matches_created INTEGER DEFAULT 0, messages_sent INTEGER DEFAULT 0
);

CREATE TABLE dashboard_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), type VARCHAR(50), message TEXT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE dashboard_notifications (
    id INTEGER PRIMARY KEY DEFAULT 1, message TEXT, type VARCHAR(50), created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO dashboard_notifications (id, message, type) VALUES (1, 'System Initialized', 'info') ON CONFLICT (id) DO NOTHING;

-- 5. RPC Functions
CREATE OR REPLACE FUNCTION matchmaker_create_reservation(
  p_session_a UUID, p_session_b UUID, p_expires_at TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
  v_res_id UUID; v_locked_a BOOLEAN; v_locked_b BOOLEAN;
BEGIN
  IF p_session_a < p_session_b THEN
    v_locked_a := pg_try_advisory_xact_lock(hashtext(p_session_a::text)); v_locked_b := pg_try_advisory_xact_lock(hashtext(p_session_b::text));
  ELSE
    v_locked_b := pg_try_advisory_xact_lock(hashtext(p_session_b::text)); v_locked_a := pg_try_advisory_xact_lock(hashtext(p_session_a::text));
  END IF;
  IF NOT (v_locked_a AND v_locked_b) THEN RETURN jsonb_build_object('success', false, 'reason', 'Failed to acquire locks'); END IF;
  IF NOT EXISTS (SELECT 1 FROM visitor_sessions WHERE id = p_session_a AND status = 'SEARCHING') THEN RETURN jsonb_build_object('success', false, 'reason', 'User A not SEARCHING'); END IF;
  IF NOT EXISTS (SELECT 1 FROM visitor_sessions WHERE id = p_session_b AND status = 'SEARCHING') THEN RETURN jsonb_build_object('success', false, 'reason', 'User B not SEARCHING'); END IF;
  IF EXISTS (SELECT 1 FROM reservations WHERE (session_a IN (p_session_a, p_session_b) OR session_b IN (p_session_a, p_session_b)) AND status = 'pending') THEN RETURN jsonb_build_object('success', false, 'reason', 'Pending reservation exists'); END IF;
  UPDATE visitor_sessions SET status = 'RESERVED', last_activity = now() WHERE id IN (p_session_a, p_session_b);
  INSERT INTO reservations (session_a, session_b, expires_at) VALUES (p_session_a, p_session_b, p_expires_at) RETURNING id INTO v_res_id;
  RETURN jsonb_build_object('success', true, 'reservation_id', v_res_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_matchmaker_metrics(
    p_total_searching_users INTEGER, p_avg_wait NUMERIC, p_max_wait NUMERIC,
    p_succ INTEGER, p_fail INTEGER, p_rematches INTEGER, p_abandoned INTEGER
) RETURNS void AS $$
BEGIN
    UPDATE matchmaker_metrics SET 
        total_searching_users = p_total_searching_users, average_wait_time = p_avg_wait, maximum_wait_time = p_max_wait,
        successful_matches = p_succ, failed_matches = p_fail, rematches = p_rematches, abandoned_searches = p_abandoned,
        updated_at = now()
    WHERE id = 1;
END;
$$ LANGUAGE plpgsql;

-- 6. Realtime configuration
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE visitor_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE temporary_messages;
```

## 2. API Contract & JSON Payloads

When setting up your new environment, here is exactly what data flows back and forth:

**A. `/api/start-session` (POST)**
*   **Request JSON:** `{ "sessionToken": "uuid", "browser": "Chrome", "device": "Desktop", "platform": "Windows" }`
*   **Response JSON:** `{ "sessionId": "uuid" }`

**B. `/api/join-queue` (POST)**
*   **Request JSON:** `{ "sessionId": "uuid" }`
*   **Response JSON:** `{ "success": true }`

**C. WebRTC Signaling (Supabase Realtime)**
*   **Channel:** `match:{matchId}`
*   **Payload:** `{ "type": "offer|answer|ice-candidate", "data": { ... } }`

## 3. Deployment Checklist for New Account

1. Create a new Supabase Project.
2. Go to **SQL Editor** and execute the massive block above.
3. Go to **Project Settings -> API** and copy:
   *   `Project URL` (This becomes `SUPABASE_URL`)
   *   `service_role secret` (This becomes `SUPABASE_SERVICE_ROLE_KEY`)
   *   `anon public` (This becomes `VITE_SUPABASE_PUBLISHABLE_KEY`)
4. Open your **Cloudflare Dashboard**:
   *   **indiatv-backend (Worker):** Replace the Encrypted Secret `SUPABASE_SERVICE_ROLE_KEY` with the new one.
   *   **7-4-2026-kaboom (Pages):** Replace `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Provide the new `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` back to me so I can update the `backend/wrangler.toml` file in the codebase.

> [!WARNING]
> Please do not click Proceed until you have created your new account, run the SQL script, and updated your Cloudflare dashboard keys. Provide me the keys here so I can hardcode the new URL in `wrangler.toml` to prevent Cloudflare from wiping it again!
