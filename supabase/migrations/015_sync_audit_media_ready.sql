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
