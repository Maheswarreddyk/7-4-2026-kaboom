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
