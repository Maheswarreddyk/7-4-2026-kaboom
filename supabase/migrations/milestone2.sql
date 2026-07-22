BEGIN;

-- 1. Soft Deletion on visitor_sessions
ALTER TABLE visitor_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_active_sessions ON visitor_sessions(id) WHERE status != 'DELETED';

-- 2. Fix Constraints on matches (Change from CASCADE to RESTRICT)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_a_fkey;
ALTER TABLE matches ADD CONSTRAINT matches_user_a_fkey FOREIGN KEY (user_a) REFERENCES visitor_sessions(id) ON DELETE RESTRICT;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_user_b_fkey;
ALTER TABLE matches ADD CONSTRAINT matches_user_b_fkey FOREIGN KEY (user_b) REFERENCES visitor_sessions(id) ON DELETE RESTRICT;

-- Fix Constraints on reports
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reporter_session_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_reporter_session_fkey FOREIGN KEY (reporter_session) REFERENCES visitor_sessions(id) ON DELETE RESTRICT;

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reported_session_fkey;
ALTER TABLE reports ADD CONSTRAINT reports_reported_session_fkey FOREIGN KEY (reported_session) REFERENCES visitor_sessions(id) ON DELETE RESTRICT;

-- 3. Implement Realtime Authorization policies on realtime.messages
-- Ensure Realtime extension exists and realtime schema exists (they are internal to Supabase)
-- NOTE: We apply RLS to realtime.messages to secure broadcast channels.

DROP POLICY IF EXISTS "Authorize Match Channel" ON realtime.messages;
CREATE POLICY "Authorize Match Channel"
ON realtime.messages
FOR INSERT 
TO authenticated
WITH CHECK (
  (extension = 'broadcast' OR extension = 'presence')
  AND topic LIKE 'match:%'
  AND EXISTS (
    SELECT 1 FROM public.matches 
    WHERE id = CAST(split_part(topic, ':', 2) AS UUID)
    AND (user_a = auth.uid() OR user_b = auth.uid())
  )
);

COMMIT;
