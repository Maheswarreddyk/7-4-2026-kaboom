-- Migration 004: Fix likes table unique constraint
-- The code expects a UNIQUE constraint on (match_id, session_id) to prevent duplicate likes,
-- catching error code 23505 for duplicate handling. But the constraint was never defined.

ALTER TABLE likes ADD CONSTRAINT likes_match_session_unique UNIQUE (match_id, session_id);
