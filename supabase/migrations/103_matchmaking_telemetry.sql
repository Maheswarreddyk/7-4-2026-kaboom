-- =============================================================================
-- Migration 103: Matchmaking Decision Telemetry
-- =============================================================================
-- Adds the `matchmaking_decisions` table and rewrites `execute_matchmaking` to
-- record its full candidate-evaluation decision process into that table.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. TABLE: matchmaking_decisions
-- ---------------------------------------------------------------------------
-- Stores one row per matchmaking attempt, capturing every candidate evaluated
-- during a single call to execute_matchmaking, along with timing data and the
-- final outcome.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS matchmaking_decisions (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    searcher_id               UUID        NOT NULL REFERENCES visitor_sessions(id),
    chosen_partner_id         UUID        REFERENCES visitor_sessions(id),       -- NULL when no match found
    search_started_at         TIMESTAMPTZ NOT NULL,
    search_ended_at           TIMESTAMPTZ NOT NULL,
    search_duration_ms        INTEGER,                                            -- derived: (ended - started) in ms
    candidates_evaluated      JSONB       NOT NULL DEFAULT '[]'::JSONB,           -- array of up to 50 evaluated candidates
    total_candidates_in_queue INTEGER,                                            -- count of queue entries visible before scoring
    final_score               INTEGER,                                            -- score of the chosen candidate, NULL if no match
    final_reason              TEXT,                                               -- human-readable outcome description
    stage_name                TEXT,                                               -- logical stage label (e.g. 'standard', 'relaxed')
    created_at                TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  matchmaking_decisions                        IS 'Records every matchmaking decision attempt with full candidate telemetry.';
COMMENT ON COLUMN matchmaking_decisions.candidates_evaluated   IS 'JSONB array (max 50) of candidates evaluated, each: {rank, session_id, display_name, gender, looking_for, score, status, reject_reason}.';
COMMENT ON COLUMN matchmaking_decisions.search_duration_ms     IS 'Wall-clock milliseconds from when candidate scan started to when decision completed, measured with clock_timestamp().';
COMMENT ON COLUMN matchmaking_decisions.stage_name             IS 'Logical matchmaking stage label to support future multi-stage expansion.';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_matchmaking_decisions_searcher_id
    ON matchmaking_decisions (searcher_id);

CREATE INDEX IF NOT EXISTS idx_matchmaking_decisions_created_at
    ON matchmaking_decisions (created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. FUNCTION: execute_matchmaking(p_session_id UUID)
-- ---------------------------------------------------------------------------
-- Rewrites the existing function to:
--   a. Time the search with clock_timestamp().
--   b. Lock its own queue entry (SKIP LOCKED to avoid deadlocks).
--   c. Evaluate ALL eligible queue candidates, score each, cap at top 50.
--   d. Build a JSONB candidate log.
--   e. Insert a matchmaking_decisions row regardless of outcome.
--   f. On a successful match: create match row, purge both queue entries,
--      update both session statuses.
--   g. Return JSONB: { success, match_id, reason, decision_id }.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION execute_matchmaking(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    -- Timing
    v_search_started         TIMESTAMPTZ;
    v_search_ended           TIMESTAMPTZ;
    v_duration_ms            INTEGER;

    -- Self
    v_self_queue_id          UUID;
    v_self                   visitor_sessions%ROWTYPE;

    -- Candidate iteration (via implicit record in FOR loop)
    v_score                  INTEGER;

    -- Scored-candidate JSONB pools
    v_all_scored             JSONB := '[]'::JSONB;   -- candidates that passed hard filter (score >= 0)
    v_all_rejected           JSONB := '[]'::JSONB;   -- hard-filtered candidates (score < 0)
    v_candidates_log         JSONB := '[]'::JSONB;   -- final annotated log (max 50)

    -- Best match tracking
    v_best_score             INTEGER := -1;
    v_best_session_id        UUID    := NULL;
    v_best_queue_id          UUID    := NULL;

    -- Telemetry
    v_total_in_queue         INTEGER := 0;

    -- Output
    v_match_id               UUID    := NULL;
    v_decision_id            UUID    := NULL;
    v_reason                 TEXT    := 'No suitable match found';
    v_success                BOOLEAN := FALSE;

    -- Candidate record
    v_cand_session           visitor_sessions%ROWTYPE;
    v_cand_rec               RECORD;
BEGIN
    -- -----------------------------------------------------------------------
    -- Mark search start (wall clock, not transaction start)
    -- -----------------------------------------------------------------------
    v_search_started := clock_timestamp();

    -- -----------------------------------------------------------------------
    -- Fetch and lock the searcher's own queue entry
    -- -----------------------------------------------------------------------
    SELECT id
    INTO   v_self_queue_id
    FROM   waiting_queue
    WHERE  session_id = p_session_id
      AND  status     = 'waiting'
    FOR UPDATE SKIP LOCKED;

    IF v_self_queue_id IS NULL THEN
        -- Searcher is no longer in the queue (already matched or removed)
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
        )
        RETURNING id INTO v_decision_id;

        RETURN jsonb_build_object(
            'success',     FALSE,
            'match_id',    NULL,
            'reason',      v_reason,
            'decision_id', v_decision_id
        );
    END IF;

    -- -----------------------------------------------------------------------
    -- Load self session data
    -- -----------------------------------------------------------------------
    SELECT * INTO v_self
    FROM   visitor_sessions
    WHERE  id = p_session_id;

    -- -----------------------------------------------------------------------
    -- Count total candidates currently in queue (snapshot before scoring)
    -- -----------------------------------------------------------------------
    SELECT COUNT(*) INTO v_total_in_queue
    FROM   waiting_queue
    WHERE  status     = 'waiting'
      AND  session_id <> p_session_id;

    -- -----------------------------------------------------------------------
    -- Evaluate every eligible candidate
    -- -----------------------------------------------------------------------
    FOR v_cand_rec IN
        SELECT wq.id         AS queue_id,
               wq.session_id AS session_id
        FROM   waiting_queue wq
        WHERE  wq.status     = 'waiting'
          AND  wq.session_id <> p_session_id
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Fetch full session detail for this candidate
        SELECT * INTO v_cand_session
        FROM   visitor_sessions
        WHERE  id = v_cand_rec.session_id;

        CONTINUE WHEN NOT FOUND;

        -- Compute compatibility score
        v_score := calculate_match_score(p_session_id, v_cand_rec.session_id);

        IF v_score >= 0 THEN
            -- Track global best
            IF v_score > v_best_score THEN
                v_best_score      := v_score;
                v_best_session_id := v_cand_rec.session_id;
                v_best_queue_id   := v_cand_rec.queue_id;
            END IF;

            v_all_scored := v_all_scored || jsonb_build_object(
                'session_id',   v_cand_rec.session_id,
                'queue_id',     v_cand_rec.queue_id,
                'display_name', v_cand_session.display_name,
                'gender',       v_cand_session.gender,
                'looking_for',  to_jsonb(v_cand_session.looking_for),
                'score',        v_score
            );
        ELSE
            v_all_rejected := v_all_rejected || jsonb_build_object(
                'session_id',   v_cand_rec.session_id,
                'queue_id',     v_cand_rec.queue_id,
                'display_name', v_cand_session.display_name,
                'gender',       v_cand_session.gender,
                'looking_for',  to_jsonb(v_cand_session.looking_for),
                'score',        v_score
            );
        END IF;
    END LOOP;

    -- -----------------------------------------------------------------------
    -- Build annotated candidate log (max 50 entries)
    -- Order: viable by score DESC (chosen first, then lower-priority),
    --        then hard-rejected appended afterwards.
    -- -----------------------------------------------------------------------
    WITH viable_ranked AS (
        SELECT
            elem,
            ROW_NUMBER() OVER (ORDER BY (elem->>'score')::INTEGER DESC) AS rn
        FROM jsonb_array_elements(v_all_scored) AS elem
    ),
    viable_annotated AS (
        SELECT
            rn AS ord,
            jsonb_build_object(
                'rank',          rn,
                'session_id',    elem->>'session_id',
                'display_name',  elem->>'display_name',
                'gender',        elem->>'gender',
                'looking_for',   elem->'looking_for',
                'score',         (elem->>'score')::INTEGER,
                'status',        CASE WHEN (elem->>'session_id')::UUID = v_best_session_id
                                      THEN 'chosen'
                                      ELSE 'rejected'
                                 END,
                'reject_reason', CASE WHEN (elem->>'session_id')::UUID = v_best_session_id
                                      THEN NULL
                                      ELSE 'Lower Priority'
                                 END
            ) AS entry
        FROM viable_ranked
        WHERE rn <= 40
    ),
    rejected_annotated AS (
        SELECT
            40 + ROW_NUMBER() OVER () AS ord,
            jsonb_build_object(
                'rank',          40 + ROW_NUMBER() OVER (),
                'session_id',    elem->>'session_id',
                'display_name',  elem->>'display_name',
                'gender',        elem->>'gender',
                'looking_for',   elem->'looking_for',
                'score',         -1,
                'status',        'rejected',
                'reject_reason', 'Hard Filter (incompatible preferences)'
            ) AS entry
        FROM jsonb_array_elements(v_all_rejected) AS elem
        LIMIT 10
    )
    SELECT COALESCE(jsonb_agg(entry ORDER BY ord), '[]'::JSONB)
    INTO   v_candidates_log
    FROM (
        SELECT ord, entry FROM viable_annotated
        UNION ALL
        SELECT ord, entry FROM rejected_annotated
    ) combined
    WHERE ord <= 50;


    -- -----------------------------------------------------------------------
    -- Mark search end and compute duration
    -- -----------------------------------------------------------------------
    v_search_ended := clock_timestamp();
    v_duration_ms  := EXTRACT(EPOCH FROM (v_search_ended - v_search_started)) * 1000;

    -- -----------------------------------------------------------------------
    -- If a best candidate was found, create the match
    -- -----------------------------------------------------------------------
    IF v_best_session_id IS NOT NULL THEN

        INSERT INTO matches (
            user_a,
            user_b,
            match_score,
            matched_reason,
            match_reason_metadata,
            status
        ) VALUES (
            p_session_id,
            v_best_session_id,
            v_best_score,
            'Matchmaking algorithm',
            jsonb_build_object(
                'algorithm_version', 103,
                'stage',             'standard',
                'score',             v_best_score,
                'searcher_id',       p_session_id,
                'partner_id',        v_best_session_id
            ),
            'active'
        )
        RETURNING id INTO v_match_id;

        -- Remove both participants from the waiting queue
        DELETE FROM waiting_queue
        WHERE  id IN (v_self_queue_id, v_best_queue_id);

        -- Update session statuses to 'matched'
        UPDATE visitor_sessions
        SET    status       = 'matched',
               last_partner = CASE
                                  WHEN id = p_session_id      THEN v_best_session_id
                                  WHEN id = v_best_session_id THEN p_session_id
                              END
        WHERE  id IN (p_session_id, v_best_session_id);

        v_success := TRUE;
        v_reason  := 'Match found with score ' || v_best_score::TEXT;

    END IF;

    -- -----------------------------------------------------------------------
    -- Insert telemetry record (always, regardless of outcome)
    -- -----------------------------------------------------------------------
    INSERT INTO matchmaking_decisions (
        searcher_id,
        chosen_partner_id,
        search_started_at,
        search_ended_at,
        search_duration_ms,
        candidates_evaluated,
        total_candidates_in_queue,
        final_score,
        final_reason,
        stage_name
    ) VALUES (
        p_session_id,
        v_best_session_id,
        v_search_started,
        v_search_ended,
        v_duration_ms,
        v_candidates_log,
        v_total_in_queue,
        CASE WHEN v_best_session_id IS NOT NULL THEN v_best_score ELSE NULL END,
        v_reason,
        'standard'
    )
    RETURNING id INTO v_decision_id;

    -- -----------------------------------------------------------------------
    -- Return result
    -- -----------------------------------------------------------------------
    RETURN jsonb_build_object(
        'success',     v_success,
        'match_id',    v_match_id,
        'reason',      v_reason,
        'decision_id', v_decision_id
    );

EXCEPTION WHEN OTHERS THEN
    -- Surface errors as observable JSONB; never swallow silently
    RETURN jsonb_build_object(
        'success',     FALSE,
        'match_id',    NULL,
        'reason',      'Unhandled exception: ' || SQLERRM,
        'decision_id', NULL
    );
END;
$$;

COMMENT ON FUNCTION execute_matchmaking(UUID) IS
    'Runs one matchmaking cycle for a waiting session. '
    'Evaluates all eligible queue candidates via calculate_match_score, '
    'records full telemetry in matchmaking_decisions, and creates a match row on success. '
    'Returns JSONB: { success BOOL, match_id UUID, reason TEXT, decision_id UUID }.';

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- Block all direct client access; all reads/writes go through service-role
-- or trusted server functions only.
-- ---------------------------------------------------------------------------

ALTER TABLE matchmaking_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block All" ON matchmaking_decisions;

CREATE POLICY "Block All"
    ON matchmaking_decisions
    AS RESTRICTIVE
    FOR ALL
    USING (FALSE);

-- ---------------------------------------------------------------------------
-- 5. REALTIME PUBLICATION
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_decisions;

-- ---------------------------------------------------------------------------

COMMIT;
