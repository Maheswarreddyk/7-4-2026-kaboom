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
