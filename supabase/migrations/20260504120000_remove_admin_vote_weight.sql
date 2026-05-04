-- =============================================================================
-- Migration: Remove admin vote weight
--
-- Admin votes used to count 2.0 in award aggregation. They now count like any
-- other vote: 1.0 if the voter attended the event, 0.5 otherwise.
--
-- 1. _compute_award_winner: drop the admin branch from the weight CASE
-- 2. cast_award_vote: stop looking up / writing voter_is_admin
-- 3. Drop the now-unused voter_is_admin column on event_award_votes
-- =============================================================================


-- ─── 1. Drop admin branch from the weight aggregation ──────────────────────

CREATE OR REPLACE FUNCTION _compute_award_winner(
  p_event_id bigint,
  p_award_type text
)
RETURNS TABLE (
  state text,
  winner_id bigint,
  tied_candidates bigint[]
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_top_candidates bigint[];
BEGIN
  WITH scored AS (
    SELECT
      v.candidate_player_id,
      SUM(
        CASE
          WHEN EXISTS (
            SELECT 1 FROM public.event_participants ep
            WHERE ep.event_id = p_event_id AND ep.player_id = v.voter_player_id
          ) THEN 1.0
          ELSE 0.5
        END
      ) AS score
    FROM public.event_award_votes v
    WHERE v.event_id = p_event_id AND v.award_type = p_award_type
    GROUP BY v.candidate_player_id
  ),
  ranked AS (
    SELECT candidate_player_id, RANK() OVER (ORDER BY score DESC) AS rk
    FROM scored
  )
  SELECT ARRAY_AGG(candidate_player_id) INTO v_top_candidates
  FROM ranked
  WHERE rk = 1;

  IF v_top_candidates IS NULL OR array_length(v_top_candidates, 1) = 0 THEN
    RETURN QUERY SELECT 'no_votes'::text, NULL::bigint, NULL::bigint[];
  ELSIF array_length(v_top_candidates, 1) = 1 THEN
    RETURN QUERY SELECT 'winner'::text, v_top_candidates[1], NULL::bigint[];
  ELSE
    RETURN QUERY SELECT 'tied'::text, NULL::bigint, v_top_candidates;
  END IF;
END;
$$;


-- ─── 2. Stop persisting voter_is_admin on cast ─────────────────────────────

CREATE OR REPLACE FUNCTION cast_award_vote(
  p_event_id bigint,
  p_award_type text,
  p_candidate_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_voter_email text;
  v_voter_player_id bigint;
  v_event_type text;
  v_window_state text;
BEGIN
  v_voter_email := auth.jwt() ->> 'email';
  IF v_voter_email IS NULL THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  SELECT id INTO v_voter_player_id
  FROM public.players
  WHERE email = v_voter_email;

  IF v_voter_player_id IS NULL THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  SELECT type INTO v_event_type FROM public.events WHERE id = p_event_id;
  IF v_event_type IS NULL OR v_event_type NOT IN ('match', 'tournament') THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  SELECT state INTO v_window_state FROM public._event_vote_window(p_event_id);
  IF v_window_state != 'open' THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id AND player_id = p_candidate_id
  ) THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  INSERT INTO public.event_award_votes (
    event_id, award_type, voter_player_id, candidate_player_id, cast_at
  )
  VALUES (p_event_id, p_award_type, v_voter_player_id, p_candidate_id, now())
  ON CONFLICT (event_id, award_type, voter_player_id)
  DO UPDATE SET
    candidate_player_id = EXCLUDED.candidate_player_id,
    cast_at = now();
END;
$$;


-- ─── 3. Drop the now-unused column ─────────────────────────────────────────

ALTER TABLE event_award_votes DROP COLUMN voter_is_admin;
