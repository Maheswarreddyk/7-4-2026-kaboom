-- Migration 018: Distributed Heal Cycle RPC
-- Consolidates queue and reservation healing logic into a single, atomic database transaction.

CREATE OR REPLACE FUNCTION matchmaker_heal_cycle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    now_ts timestamp with time zone := now();
    affected_sessions uuid[];
BEGIN
    -- 1. Expire stale reservations
    -- Find all reservations that have expired and are still pending
    WITH expired_resvs AS (
        UPDATE reservations
        SET status = 'rolled_back'
        WHERE status = 'pending' AND expires_at < now_ts
        RETURNING user_a, user_b, initiator_session_id, partner_session_id
    )
    SELECT array_agg(DISTINCT u.id) INTO affected_sessions
    FROM (
        SELECT user_a AS id FROM expired_resvs WHERE user_a IS NOT NULL
        UNION
        SELECT user_b FROM expired_resvs WHERE user_b IS NOT NULL
        UNION
        SELECT initiator_session_id FROM expired_resvs WHERE initiator_session_id IS NOT NULL
        UNION
        SELECT partner_session_id FROM expired_resvs WHERE partner_session_id IS NOT NULL
    ) u;

    -- Recover sessions from expired reservations
    IF array_length(affected_sessions, 1) > 0 THEN
        UPDATE visitor_sessions
        SET status = 'SEARCHING', last_activity = now_ts
        WHERE id = ANY(affected_sessions);

        UPDATE waiting_queue
        SET status = 'waiting', last_seen = now_ts
        WHERE session_id = ANY(affected_sessions) AND status = 'matched';
    END IF;

    -- 2. Recover orphaned RESERVED sessions
    -- Find sessions in RESERVED state without any active reservation
    WITH orphaned AS (
        SELECT v.id
        FROM visitor_sessions v
        LEFT JOIN reservations r ON 
            (r.user_a = v.id OR r.user_b = v.id OR r.initiator_session_id = v.id OR r.partner_session_id = v.id)
            AND r.status = 'pending'
        WHERE v.status = 'RESERVED' AND r.id IS NULL
    )
    UPDATE visitor_sessions
    SET status = 'SEARCHING', last_activity = now_ts
    WHERE id IN (SELECT id FROM orphaned);

    -- Ensure orphaned sessions are marked as waiting in the queue
    WITH orphaned AS (
        SELECT v.id
        FROM visitor_sessions v
        LEFT JOIN reservations r ON 
            (r.user_a = v.id OR r.user_b = v.id OR r.initiator_session_id = v.id OR r.partner_session_id = v.id)
            AND r.status = 'pending'
        WHERE v.status = 'RESERVED' AND r.id IS NULL
    )
    UPDATE waiting_queue
    SET status = 'waiting', last_seen = now_ts
    WHERE session_id IN (SELECT id FROM orphaned) AND status = 'matched';

END;
$$;
