-- Optimization for Matchmaking: Removing O(N) loops and fixing STRICT mode

-- 1. Redefine calculate_match_score to correctly handle STRICT empty arrays
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

        -- STRICT Array constraints check (don't fail if one is empty)
        IF v_self.interest_tags IS NOT NULL AND array_length(v_self.interest_tags, 1) > 0 THEN
            IF v_partner.interest_tags IS NULL OR array_length(v_partner.interest_tags, 1) = 0 OR NOT (v_self.interest_tags && v_partner.interest_tags) THEN
                RETURN -1;
            END IF;
        END IF;
        IF v_self.languages IS NOT NULL AND array_length(v_self.languages, 1) > 0 THEN
            IF v_partner.languages IS NULL OR array_length(v_partner.languages, 1) = 0 OR NOT (v_self.languages && v_partner.languages) THEN
                RETURN -1;
            END IF;
        END IF;
    END IF;

    -- Gender Base Score (The Priority Ladder)
    IF v_a_matches_b AND v_b_matches_a THEN
        IF v_a_specific AND v_b_specific THEN
            v_score := v_score + 500;
        ELSIF v_a_specific OR v_b_specific THEN
            v_score := v_score + 300;
        ELSE
            v_score := v_score + 100;
        END IF;
    ELSE
        RETURN -1;
    END IF;

    -- Compute Shared Tags (10 points each)
    IF v_self.interest_tags IS NOT NULL AND v_partner.interest_tags IS NOT NULL THEN
        SELECT count(*) INTO v_shared_ints 
        FROM (SELECT unnest(v_self.interest_tags) INTERSECT SELECT unnest(v_partner.interest_tags)) as i;
        v_score := v_score + (v_shared_ints * 10);
    END IF;

    -- Compute Shared Languages (20 points each)
    IF v_self.languages IS NOT NULL AND v_partner.languages IS NOT NULL THEN
        SELECT count(*) INTO v_shared_langs 
        FROM (SELECT unnest(v_self.languages) INTERSECT SELECT unnest(v_partner.languages)) as l;
        v_score := v_score + (v_shared_langs * 20);
    END IF;
    
    -- Location Match (40 points)
    IF v_self.country IS NOT NULL AND v_partner.country IS NOT NULL AND v_self.country = v_partner.country THEN
        v_score := v_score + 40;
    END IF;

    -- Randomness injection for 'RANDOM' mode
    IF v_self.match_mode = 'RANDOM' THEN
        -- Add a random spread between 0 and 50 points to shuffle equally valid candidates
        v_score := v_score + (random() * 50)::INTEGER;
    END IF;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Redefine execute_matchmaking to be O(1) query-based instead of O(N) PL/pgSQL loops
CREATE OR REPLACE FUNCTION execute_matchmaking(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_self_queue_id          UUID;
    v_self                   RECORD;
    v_best_session_id        UUID;
    v_best_queue_id          UUID;
    v_best_score             INTEGER := -1;
    v_total_in_queue         INTEGER := 0;
    v_search_started         TIMESTAMP WITH TIME ZONE;
    v_search_ended           TIMESTAMP WITH TIME ZONE;
    v_duration_ms            REAL;
    v_decision_id            UUID;
    v_reason                 TEXT;
    v_all_scored             JSONB := '[]'::JSONB;
BEGIN
    v_search_started := clock_timestamp();

    -- Fetch and lock the searcher's own queue entry
    SELECT id INTO v_self_queue_id
    FROM   waiting_queue
    WHERE  session_id = p_session_id
      AND  status     = 'waiting'
    FOR UPDATE SKIP LOCKED;

    IF v_self_queue_id IS NULL THEN
        v_search_ended := clock_timestamp();
        v_duration_ms  := EXTRACT(EPOCH FROM (v_search_ended - v_search_started)) * 1000;
        v_reason       := 'Searcher not in waiting queue';

        INSERT INTO matchmaking_decisions (
            searcher_id, chosen_partner_id,
            search_started_at, search_ended_at, search_duration_ms,
            candidates_evaluated, total_candidates_in_queue,
            final_score, final_reason, stage_name
        ) VALUES (
            p_session_id, NULL,
            v_search_started, v_search_ended, v_duration_ms,
            '[]'::JSONB, 0,
            NULL, v_reason, 'aborted'
        ) RETURNING id INTO v_decision_id;

        RETURN jsonb_build_object('success', FALSE, 'match_id', NULL, 'reason', v_reason, 'decision_id', v_decision_id);
    END IF;

    SELECT * INTO v_self FROM visitor_sessions WHERE id = p_session_id;

    SELECT COUNT(*) INTO v_total_in_queue
    FROM waiting_queue
    WHERE status = 'waiting' AND session_id <> p_session_id;

    -- O(1) set-based query to find the best match using the DB execution engine directly
    -- We join the queue directly with visitor_sessions and calculate score, ordering by score DESC.
    -- LIMIT 1 avoids evaluating score for all records once the top is found if DB uses index or optimizes,
    -- but even with full scan it's 1 query vs N queries.
    WITH candidates AS (
        SELECT wq.id as queue_id, wq.session_id, vs.display_name, vs.gender, vs.looking_for,
               calculate_match_score(p_session_id, wq.session_id) as score
        FROM waiting_queue wq
        JOIN visitor_sessions vs ON vs.id = wq.session_id
        WHERE wq.status = 'waiting' 
          AND wq.session_id <> p_session_id
    )
    SELECT queue_id, session_id, score 
    INTO v_best_queue_id, v_best_session_id, v_best_score
    FROM candidates
    WHERE score >= 0
    ORDER BY score DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_best_session_id IS NOT NULL THEN
        -- We found a match!
        v_search_ended := clock_timestamp();
        v_duration_ms  := EXTRACT(EPOCH FROM (v_search_ended - v_search_started)) * 1000;
        
        -- Mark both as matched
        UPDATE waiting_queue SET status = 'matched' WHERE id IN (v_self_queue_id, v_best_queue_id);
        UPDATE visitor_sessions SET status = 'MATCH_FOUND' WHERE id IN (p_session_id, v_best_session_id);

        -- Telemetry
        v_all_scored := jsonb_build_array(
            jsonb_build_object(
                'session_id', v_best_session_id,
                'score', v_best_score,
                'status', 'chosen'
            )
        );

        INSERT INTO matchmaking_decisions (
            searcher_id, chosen_partner_id, search_started_at, search_ended_at, search_duration_ms,
            candidates_evaluated, total_candidates_in_queue, final_score, final_reason, stage_name
        ) VALUES (
            p_session_id, v_best_session_id, v_search_started, v_search_ended, v_duration_ms,
            v_all_scored, v_total_in_queue, v_best_score, 'Match found', 'success'
        ) RETURNING id INTO v_decision_id;

        RETURN jsonb_build_object('success', TRUE, 'match_id', v_decision_id, 'partner_id', v_best_session_id);
    ELSE
        -- No match
        v_search_ended := clock_timestamp();
        v_duration_ms  := EXTRACT(EPOCH FROM (v_search_ended - v_search_started)) * 1000;

        INSERT INTO matchmaking_decisions (
            searcher_id, chosen_partner_id, search_started_at, search_ended_at, search_duration_ms,
            candidates_evaluated, total_candidates_in_queue, final_score, final_reason, stage_name
        ) VALUES (
            p_session_id, NULL, v_search_started, v_search_ended, v_duration_ms,
            '[]'::JSONB, v_total_in_queue, NULL, 'No viable candidates', 'failed'
        ) RETURNING id INTO v_decision_id;

        RETURN jsonb_build_object('success', FALSE, 'match_id', NULL, 'reason', 'No viable candidates', 'decision_id', v_decision_id);
    END IF;
END;
$$ LANGUAGE plpgsql;
