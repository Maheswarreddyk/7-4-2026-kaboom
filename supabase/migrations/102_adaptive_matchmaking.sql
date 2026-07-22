-- Migration: Adaptive Matchmaking Intelligence Engine
-- 1. Update Schema
ALTER TABLE visitor_sessions 
ADD COLUMN IF NOT EXISTS skip_history UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS total_matches INTEGER DEFAULT 0;

-- 2. Drop old functions
DROP FUNCTION IF EXISTS calculate_match_score(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS calculate_match_score(UUID, UUID);
DROP FUNCTION IF EXISTS execute_matchmaking(UUID);

-- 3. New Scoring Function
CREATE OR REPLACE FUNCTION calculate_match_score(
    p_self_id UUID,
    p_partner_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 0;
    v_self RECORD;
    v_partner RECORD;
    v_a_specific BOOLEAN;
    v_b_specific BOOLEAN;
    v_a_matches_b BOOLEAN;
    v_b_matches_a BOOLEAN;
    v_shared_langs INTEGER := 0;
    v_shared_ints INTEGER := 0;
    v_self_wait INTEGER := 0;
    v_partner_wait INTEGER := 0;
BEGIN
    SELECT * INTO v_self FROM visitor_sessions WHERE id = p_self_id;
    SELECT * INTO v_partner FROM visitor_sessions WHERE id = p_partner_id;

    -- Avoid recently skipped users
    IF p_partner_id = ANY(v_self.skip_history) OR p_self_id = ANY(v_partner.skip_history) THEN
        RETURN -1;
    END IF;
    
    -- Avoid immediate rematches
    IF v_self.last_partner = p_partner_id THEN
        RETURN -1;
    END IF;

    -- Analyze Gender Preferences
    v_a_specific := (v_self.looking_for IS NOT NULL AND array_length(v_self.looking_for, 1) > 0 AND NOT ('anyone' = ANY(v_self.looking_for)));
    v_b_specific := (v_partner.looking_for IS NOT NULL AND array_length(v_partner.looking_for, 1) > 0 AND NOT ('anyone' = ANY(v_partner.looking_for)));
    
    v_a_matches_b := (NOT v_a_specific) OR (v_partner.gender IS NOT NULL AND v_partner.gender = ANY(v_self.looking_for));
    v_b_matches_a := (NOT v_b_specific) OR (v_self.gender IS NOT NULL AND v_self.gender = ANY(v_partner.looking_for));

    -- EXACT Mode Enforcement
    IF v_self.match_mode = 'EXACT' OR v_partner.match_mode = 'EXACT' THEN
        -- Exact requires strict mutual consent
        IF NOT (v_a_matches_b AND v_b_matches_a) THEN
            RETURN -1;
        END IF;
    END IF;

    -- Gender Base Score (The Priority Ladder)
    IF v_a_matches_b AND v_b_matches_a THEN
        IF v_a_specific AND v_b_specific THEN
            v_score := v_score + 100000; -- Tier 1: Perfect Mutual Specific
        ELSIF v_a_specific OR v_b_specific THEN
            v_score := v_score + 50000;  -- Tier 2: One-Sided Specific
        ELSE
            v_score := v_score + 25000;  -- Tier 3: Both Anyone
        END IF;
    ELSE
        -- Fallback: Conflicting preference
        v_score := v_score + 0;
    END IF;

    -- Interest Tags (Up to 3)
    IF v_self.interest_tags IS NOT NULL AND v_partner.interest_tags IS NOT NULL THEN
        SELECT count(*) INTO v_shared_ints FROM (SELECT unnest(v_self.interest_tags) INTERSECT SELECT unnest(v_partner.interest_tags)) t;
        v_score := v_score + (v_shared_ints * 1000);
    END IF;

    -- Languages
    IF v_self.languages IS NOT NULL AND v_partner.languages IS NOT NULL THEN
        SELECT count(*) INTO v_shared_langs FROM (SELECT unnest(v_self.languages) INTERSECT SELECT unnest(v_partner.languages)) t;
        v_score := v_score + (v_shared_langs * 500);
    END IF;

    -- Location
    IF v_self.city IS NOT NULL AND v_self.city = v_partner.city THEN
        v_score := v_score + 300;
    ELSIF v_self.state IS NOT NULL AND v_self.state = v_partner.state THEN
        v_score := v_score + 100;
    ELSIF v_self.country IS NOT NULL AND v_self.country = v_partner.country THEN
        v_score := v_score + 50;
    END IF;

    -- Queue Aging (Starvation Prevention)
    IF v_self.queue_entered_at IS NOT NULL THEN
        v_self_wait := EXTRACT(EPOCH FROM (NOW() - v_self.queue_entered_at));
    END IF;
    IF v_partner.queue_entered_at IS NOT NULL THEN
        v_partner_wait := EXTRACT(EPOCH FROM (NOW() - v_partner.queue_entered_at));
    END IF;
    
    v_score := v_score + LEAST(v_self_wait, 1000) + LEAST(v_partner_wait, 1000);

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;


-- 4. Main Matchmaking Engine
CREATE OR REPLACE FUNCTION execute_matchmaking(p_session_id UUID) 
RETURNS JSONB AS $$
DECLARE
    v_self RECORD;
    v_queue_entry RECORD;
    v_partner RECORD;
    v_match_id UUID;
    v_reason JSONB;
BEGIN
    -- 1. Lock self in queue
    SELECT * INTO v_queue_entry FROM waiting_queue WHERE session_id = p_session_id AND status = 'waiting' FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'Not in queue');
    END IF;

    SELECT * INTO v_self FROM visitor_sessions WHERE id = p_session_id;

    -- 2. Rank all available candidates
    SELECT 
        w.session_id, 
        calculate_match_score(p_session_id, w.session_id) as score 
    INTO v_partner
    FROM waiting_queue w
    JOIN visitor_sessions vs ON w.session_id = vs.id
    WHERE w.session_id != p_session_id
      AND w.status = 'waiting'
      AND vs.status != 'DELETED'
    ORDER BY calculate_match_score(p_session_id, w.session_id) DESC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    -- 3. Evaluate highest ranked candidate
    IF v_partner.session_id IS NOT NULL AND v_partner.score >= 0 THEN
        -- We found a match!
        INSERT INTO matches (user_a, user_b, status, match_score) 
        VALUES (p_session_id, v_partner.session_id, 'negotiating', v_partner.score) 
        RETURNING id INTO v_match_id;

        -- Create the Transparency Payload ("Why we matched")
        IF v_partner.score >= 50000 THEN
            v_reason := jsonb_build_object('confidence', 'excellent', 'message', 'Mutual preference and shared interests.');
        ELSIF v_partner.score >= 25000 THEN
            v_reason := jsonb_build_object('confidence', 'good', 'message', 'Preferences align with some shared interests.');
        ELSE
            v_reason := jsonb_build_object('confidence', 'random', 'message', 'Connected quickly because no exact match was available.');
        END IF;

        UPDATE matches SET match_reason_metadata = v_reason WHERE id = v_match_id;

        -- Remove both from queue
        DELETE FROM waiting_queue WHERE session_id IN (p_session_id, v_partner.session_id);

        -- Update sessions
        UPDATE visitor_sessions SET 
            status = 'MATCHED', 
            last_partner = v_partner.session_id,
            total_matches = total_matches + 1
        WHERE id = p_session_id;
        
        UPDATE visitor_sessions SET 
            status = 'MATCHED', 
            last_partner = p_session_id,
            total_matches = total_matches + 1
        WHERE id = v_partner.session_id;

        RETURN jsonb_build_object('success', true, 'match_id', v_match_id, 'reason', v_reason);
    END IF;

    RETURN jsonb_build_object('success', false, 'reason', 'No eligible partners');
END;
$$ LANGUAGE plpgsql;
