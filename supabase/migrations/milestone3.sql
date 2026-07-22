-- Migration to create the execute_matchmaking RPC

-- 1. Helper Function: calculate_match_score
CREATE OR REPLACE FUNCTION calculate_match_score(
    p_self_id UUID,
    p_partner_id UUID,
    p_phase TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 0;
    v_self RECORD;
    v_partner RECORD;
    v_self_wants BOOLEAN;
    v_partner_wants BOOLEAN;
    v_shared_langs INTEGER := 0;
    v_shared_ints INTEGER := 0;
    v_wait_sec INTEGER := 0;
BEGIN
    SELECT * INTO v_self FROM visitor_sessions WHERE id = p_self_id;
    SELECT * INTO v_partner FROM visitor_sessions WHERE id = p_partner_id;

    -- Mutual Preference
    v_self_wants := (v_self.looking_for IS NULL OR array_length(v_self.looking_for, 1) IS NULL OR 'anyone' = ANY(v_self.looking_for) OR (v_partner.gender IS NOT NULL AND v_partner.gender = ANY(v_self.looking_for)));
    v_partner_wants := (v_partner.looking_for IS NULL OR array_length(v_partner.looking_for, 1) IS NULL OR 'anyone' = ANY(v_partner.looking_for) OR (v_self.gender IS NOT NULL AND v_self.gender = ANY(v_partner.looking_for)));
    
    IF NOT (v_self_wants OR v_partner_wants) THEN
        RETURN -1; -- Hard fail
    END IF;

    IF v_self_wants AND v_partner_wants THEN
        v_score := v_score + 75; -- 50 * 1.5
    ELSE
        v_score := v_score + 50;
    END IF;

    IF p_phase NOT IN ('relax_language', 'relax_location', 'random') THEN
        IF v_self.languages IS NOT NULL AND v_partner.languages IS NOT NULL THEN
            SELECT count(*) INTO v_shared_langs FROM (SELECT unnest(v_self.languages) INTERSECT SELECT unnest(v_partner.languages)) t;
            IF v_shared_langs > 0 THEN
                v_score := v_score + (POWER(2, v_shared_langs) - 1) * 20;
            END IF;
        END IF;
    END IF;

    IF p_phase NOT IN ('relax_location', 'random') THEN
        IF v_self.city IS NOT NULL AND v_self.city = v_partner.city THEN
            v_score := v_score + 40;
        ELSIF v_self.state IS NOT NULL AND v_self.state = v_partner.state THEN
            v_score := v_score + 25;
        ELSIF v_self.country IS NOT NULL AND v_self.country = v_partner.country THEN
            v_score := v_score + 10;
        END IF;
    END IF;

    IF p_phase NOT IN ('relax_interests', 'relax_language', 'relax_location', 'random') THEN
        IF v_self.interest_tags IS NOT NULL AND v_partner.interest_tags IS NOT NULL THEN
            SELECT count(*) INTO v_shared_ints FROM (SELECT unnest(v_self.interest_tags) INTERSECT SELECT unnest(v_partner.interest_tags)) t;
            IF v_shared_ints > 0 THEN
                v_score := v_score + (POWER(2, v_shared_ints) - 1) * 15;
            END IF;
        END IF;
    END IF;

    IF v_partner.queue_entered_at IS NOT NULL THEN
        v_wait_sec := EXTRACT(EPOCH FROM (NOW() - v_partner.queue_entered_at));
        v_score := v_score + LEAST(GREATEST(v_wait_sec, 0), 100);
    END IF;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- 2. Main Matchmaking Function
CREATE OR REPLACE FUNCTION execute_matchmaking(p_session_id UUID) 
RETURNS UUID AS $$
DECLARE
    v_wait_sec INTEGER;
    v_phase TEXT;
    v_threshold INTEGER;
    v_partner_id UUID;
    v_match_id UUID;
    v_self RECORD;
    v_queue_entry RECORD;
BEGIN
    -- Only allow if the session is currently waiting (locks the row to prevent race conditions)
    SELECT * INTO v_queue_entry FROM waiting_queue WHERE session_id = p_session_id AND status = 'waiting' FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_self FROM visitor_sessions WHERE id = p_session_id;

    v_wait_sec := EXTRACT(EPOCH FROM (NOW() - v_queue_entry.joined_at));

    -- Determine Phase
    IF v_wait_sec < 15 THEN
        v_phase := 'strict';
        v_threshold := 140;
    ELSIF v_wait_sec < 30 THEN
        v_phase := 'relax_interests';
        v_threshold := 110;
    ELSIF v_wait_sec < 60 THEN
        v_phase := 'relax_language';
        v_threshold := 80;
    ELSIF v_wait_sec < 120 THEN
        v_phase := 'relax_location';
        v_threshold := 50;
    ELSE
        v_phase := 'random';
        v_threshold := -9999;
    END IF;

    -- Find the best partner
    SELECT w.session_id INTO v_partner_id
    FROM waiting_queue w
    JOIN visitor_sessions vs ON w.session_id = vs.id
    WHERE w.session_id != p_session_id
      AND w.status = 'waiting'
      AND vs.status != 'DELETED'
      AND (v_self.last_partner IS NULL OR w.session_id != v_self.last_partner OR v_phase = 'random')
      AND calculate_match_score(p_session_id, w.session_id, v_phase) >= v_threshold
    ORDER BY calculate_match_score(p_session_id, w.session_id, v_phase) DESC
    FOR UPDATE SKIP LOCKED -- Lock the partner's queue entry so no one else grabs them!
    LIMIT 1;

    IF v_partner_id IS NOT NULL THEN
        -- Create Match
        INSERT INTO matches (user_a, user_b, status) VALUES (p_session_id, v_partner_id, 'negotiating') RETURNING id INTO v_match_id;

        -- Remove both from queue
        DELETE FROM waiting_queue WHERE session_id IN (p_session_id, v_partner_id);

        -- Update sessions
        UPDATE visitor_sessions SET status = 'MATCHED', last_partner = v_partner_id WHERE id = p_session_id;
        UPDATE visitor_sessions SET status = 'MATCHED', last_partner = p_session_id WHERE id = v_partner_id;

        RETURN v_match_id;
    END IF;

    -- No match found
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
