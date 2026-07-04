-- Migration 005: Matchmaking engines — idempotent queue, reservations, READY state

-- Queue heartbeat (preserve joined_at, update last_seen only)
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE waiting_queue ADD COLUMN IF NOT EXISTS queue_position INTEGER;

UPDATE waiting_queue SET last_seen = joined_at WHERE last_seen IS NULL;

CREATE INDEX IF NOT EXISTS idx_waiting_queue_last_seen ON waiting_queue(last_seen)
  WHERE status = 'waiting';

-- Match READY / negotiation gate
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_a_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS user_b_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS negotiation_started BOOLEAN NOT NULL DEFAULT FALSE;

-- Atomic reservations (5 second timeout)
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiator_session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  partner_session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'expired', 'rolled_back')),
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT reservations_different_users CHECK (initiator_session_id <> partner_session_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_initiator
  ON reservations(initiator_session_id) WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_partner
  ON reservations(partner_session_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reservations_expires_at
  ON reservations(expires_at) WHERE status = 'pending';

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny public access to reservations" ON reservations FOR ALL USING (false);
GRANT ALL ON reservations TO service_role;

-- Extend connection event enum for engine logging
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_created';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_confirmed';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'reservation_expired';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE connection_event ADD VALUE IF NOT EXISTS 'negotiation_start';
