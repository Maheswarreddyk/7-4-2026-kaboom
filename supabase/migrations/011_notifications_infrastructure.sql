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
