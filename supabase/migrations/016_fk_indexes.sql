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
