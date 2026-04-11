-- =============================================================================
-- Migration: Award voting system
--
-- Replaces admin-picked awards (5 columns on matches/tournaments) with a
-- democratic voting system. Players cast secret ballots during a 24-hour
-- window that opens 1 hour after the event starts. Admins resolve ties.
--
-- Access model: both tables have RLS enabled with ZERO policies. All reads
-- and writes go through SECURITY DEFINER RPCs. Raw votes are invisible even
-- to admins via direct SELECT — the only way to see vote data is through
-- the RPCs, which gate on window state and tie visibility.
--
-- Historical data: pre-feature award winners are seeded into
-- event_award_resolutions (not synthetic votes), preserving them as
-- authoritative "final answers". The 5 award columns on matches/tournaments
-- are dropped after seeding.
-- =============================================================================


-- ─── 1. Tables ──────────────────────────────────────────────────────────────

CREATE TABLE event_award_votes (
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  award_type text NOT NULL CHECK (award_type IN (
    'top_scorer','best_defense','mvp','best_goalie','most_effort'
  )),
  voter_player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  candidate_player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voter_is_admin boolean NOT NULL DEFAULT false,
  cast_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, award_type, voter_player_id)
);

CREATE TABLE event_award_resolutions (
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  award_type text NOT NULL CHECK (award_type IN (
    'top_scorer','best_defense','mvp','best_goalie','most_effort'
  )),
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, award_type)
);

ALTER TABLE event_award_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_award_resolutions ENABLE ROW LEVEL SECURITY;
-- NO POLICIES. All access through SECURITY DEFINER RPCs below.


-- ─── 2. Seed historical award winners into resolutions ─────────────────────

INSERT INTO event_award_resolutions (event_id, award_type, player_id)
           SELECT event_id, 'top_scorer',   top_scorer_id   FROM matches     WHERE top_scorer_id   IS NOT NULL
UNION ALL  SELECT event_id, 'best_defense', best_defense_id FROM matches     WHERE best_defense_id IS NOT NULL
UNION ALL  SELECT event_id, 'mvp',          mvp_id          FROM matches     WHERE mvp_id          IS NOT NULL
UNION ALL  SELECT event_id, 'best_goalie',  best_goalie_id  FROM matches     WHERE best_goalie_id  IS NOT NULL
UNION ALL  SELECT event_id, 'most_effort',  most_effort_id  FROM matches     WHERE most_effort_id  IS NOT NULL
UNION ALL  SELECT event_id, 'top_scorer',   top_scorer_id   FROM tournaments WHERE top_scorer_id   IS NOT NULL
UNION ALL  SELECT event_id, 'best_defense', best_defense_id FROM tournaments WHERE best_defense_id IS NOT NULL
UNION ALL  SELECT event_id, 'mvp',          mvp_id          FROM tournaments WHERE mvp_id          IS NOT NULL
UNION ALL  SELECT event_id, 'best_goalie',  best_goalie_id  FROM tournaments WHERE best_goalie_id  IS NOT NULL
UNION ALL  SELECT event_id, 'most_effort',  most_effort_id  FROM tournaments WHERE most_effort_id  IS NOT NULL;


-- ─── 3. Drop the 5 award columns from matches and tournaments ──────────────

ALTER TABLE matches
  DROP COLUMN top_scorer_id,
  DROP COLUMN best_defense_id,
  DROP COLUMN mvp_id,
  DROP COLUMN best_goalie_id,
  DROP COLUMN most_effort_id;

ALTER TABLE tournaments
  DROP COLUMN top_scorer_id,
  DROP COLUMN best_defense_id,
  DROP COLUMN mvp_id,
  DROP COLUMN best_goalie_id,
  DROP COLUMN most_effort_id;


-- ─── 4. Admin allowlist helper ──────────────────────────────────────────────
--
-- Extracted from is_admin() so it can be applied to any email (not just the
-- JWT caller's). The vote aggregator stores voter_is_admin on each row at
-- cast time, so this function is called once per vote rather than at read.

CREATE OR REPLACE FUNCTION is_admin_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_email IN (
      'nicolas.venturo@gmail.com',
      'gustavobarbaresi@gmail.com'
    ), false
  )
$$;

-- is_admin() now delegates, so the allowlist lives in one place.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.is_admin_email(auth.jwt() ->> 'email');
$$;


-- ─── 5. Window computation helper (private) ────────────────────────────────
--
-- Composes played_at + played_at_time in America/Argentina/Buenos_Aires,
-- adds 1 hour grace, opens a 24-hour window. Returns 'n/a' for trainings
-- so call sites can render gracefully instead of throwing.

CREATE OR REPLACE FUNCTION _event_vote_window(p_event_id bigint)
RETURNS TABLE (opens_at timestamptz, closes_at timestamptz, state text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_event_type text;
  v_played_at date;
  v_played_at_time time;
  v_opens_at timestamptz;
  v_closes_at timestamptz;
  v_now timestamptz := now();
BEGIN
  SELECT e.type, e.played_at, e.played_at_time
  INTO v_event_type, v_played_at, v_played_at_time
  FROM public.events e
  WHERE e.id = p_event_id;

  IF v_event_type IS NULL OR v_event_type = 'training' THEN
    RETURN QUERY SELECT NULL::timestamptz, NULL::timestamptz, 'n/a'::text;
    RETURN;
  END IF;

  v_opens_at := ((v_played_at + v_played_at_time) AT TIME ZONE 'America/Argentina/Buenos_Aires')
                + interval '1 hour';
  v_closes_at := v_opens_at + interval '24 hours';

  IF v_now < v_opens_at THEN
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'pending'::text;
  ELSIF v_now < v_closes_at THEN
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'open'::text;
  ELSE
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'closed'::text;
  END IF;
END;
$$;


-- ─── 6. Winner computation helper (private) ────────────────────────────────
--
-- Shared between get_event_award_results (single event, live) and
-- get_resolved_event_awards (all events, leaderboard). Applies weighted
-- aggregation: 2.0 for admin voters, 1.0 for voters who were event
-- participants, 0.5 otherwise. Returns ('winner', id, null), ('tied', null,
-- ids), or ('no_votes', null, null).

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
          WHEN v.voter_is_admin THEN 2.0
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


-- ─── 7. Public RPC: get window state for an event ──────────────────────────

CREATE OR REPLACE FUNCTION get_event_award_window(p_event_id bigint)
RETURNS TABLE (state text, opens_at timestamptz, closes_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT w.state, w.opens_at, w.closes_at
  FROM public._event_vote_window(p_event_id) w;
$$;

GRANT EXECUTE ON FUNCTION get_event_award_window(bigint) TO authenticated, anon;


-- ─── 8. Public RPC: cast (or update) a vote ────────────────────────────────
--
-- All failure paths use a single generic error message to avoid leaking
-- information about event state, candidate membership, window timing, etc.

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
  v_voter_is_admin boolean;
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

  v_voter_is_admin := public.is_admin_email(v_voter_email);

  INSERT INTO public.event_award_votes (
    event_id, award_type, voter_player_id, candidate_player_id,
    voter_is_admin, cast_at
  )
  VALUES (p_event_id, p_award_type, v_voter_player_id, p_candidate_id,
          v_voter_is_admin, now())
  ON CONFLICT (event_id, award_type, voter_player_id)
  DO UPDATE SET
    candidate_player_id = EXCLUDED.candidate_player_id,
    voter_is_admin = EXCLUDED.voter_is_admin,
    cast_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION cast_award_vote(bigint, text, bigint) TO authenticated;


-- ─── 9. Public RPC: clear a previously cast vote ──────────────────────────

CREATE OR REPLACE FUNCTION clear_award_vote(
  p_event_id bigint,
  p_award_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_voter_email text;
  v_voter_player_id bigint;
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

  SELECT state INTO v_window_state FROM public._event_vote_window(p_event_id);
  IF v_window_state != 'open' THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  DELETE FROM public.event_award_votes
  WHERE event_id = p_event_id
    AND award_type = p_award_type
    AND voter_player_id = v_voter_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION clear_award_vote(bigint, text) TO authenticated;


-- ─── 10. Public RPC: caller's own votes for an event ──────────────────────

CREATE OR REPLACE FUNCTION get_my_event_award_votes(p_event_id bigint)
RETURNS TABLE (award_type text, candidate_player_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_voter_email text;
  v_voter_player_id bigint;
BEGIN
  v_voter_email := auth.jwt() ->> 'email';
  IF v_voter_email IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_voter_player_id
  FROM public.players
  WHERE email = v_voter_email;

  IF v_voter_player_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT v.award_type, v.candidate_player_id
    FROM public.event_award_votes v
    WHERE v.event_id = p_event_id
      AND v.voter_player_id = v_voter_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_event_award_votes(bigint) TO authenticated;


-- ─── 11. Public RPC: per-category results for an event ────────────────────
--
-- Returns one row per award category (always 5 rows for match/tournament,
-- or 5 rows of state='n/a' for training). Mid-window calls return
-- state='pending' across the board — no preliminary tallies are ever
-- exposed. tied_candidates is only populated when the caller is_admin()
-- AND the state is 'tied'.

CREATE OR REPLACE FUNCTION get_event_award_results(p_event_id bigint)
RETURNS TABLE (
  award_type text,
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
  v_event_type text;
  v_window_state text;
  v_caller_is_admin boolean;
  v_award text;
  v_awards text[] := ARRAY['top_scorer', 'best_defense', 'mvp', 'best_goalie', 'most_effort'];
  v_resolution_player bigint;
  v_computed record;
BEGIN
  SELECT e.type INTO v_event_type FROM public.events e WHERE e.id = p_event_id;
  IF v_event_type IS NULL THEN
    RETURN;
  END IF;

  IF v_event_type = 'training' THEN
    FOREACH v_award IN ARRAY v_awards LOOP
      RETURN QUERY SELECT v_award, 'n/a'::text, NULL::bigint, NULL::bigint[];
    END LOOP;
    RETURN;
  END IF;

  SELECT w.state INTO v_window_state FROM public._event_vote_window(p_event_id) w;
  v_caller_is_admin := public.is_admin();

  FOREACH v_award IN ARRAY v_awards LOOP
    IF v_window_state != 'closed' THEN
      RETURN QUERY SELECT v_award, 'pending'::text, NULL::bigint, NULL::bigint[];
      CONTINUE;
    END IF;

    -- Resolution (historical seed OR admin tiebreaker) takes precedence.
    SELECT r.player_id INTO v_resolution_player
    FROM public.event_award_resolutions r
    WHERE r.event_id = p_event_id AND r.award_type = v_award;

    IF v_resolution_player IS NOT NULL THEN
      RETURN QUERY SELECT v_award, 'winner'::text, v_resolution_player, NULL::bigint[];
      CONTINUE;
    END IF;

    -- Compute from votes.
    SELECT c.state, c.winner_id, c.tied_candidates
    INTO v_computed
    FROM public._compute_award_winner(p_event_id, v_award) c;

    IF v_computed.state = 'tied' AND NOT v_caller_is_admin THEN
      -- Hide tied candidate names from non-admins.
      RETURN QUERY SELECT v_award, 'tied'::text, NULL::bigint, NULL::bigint[];
    ELSE
      RETURN QUERY SELECT v_award, v_computed.state, v_computed.winner_id, v_computed.tied_candidates;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_award_results(bigint) TO authenticated, anon;


-- ─── 12. Public RPC: admin resolves a tied category ───────────────────────

CREATE OR REPLACE FUNCTION resolve_event_award_tie(
  p_event_id bigint,
  p_award_type text,
  p_chosen_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acción no permitida';
  END IF;

  -- Re-compute server-side. Only a currently-tied category can be resolved,
  -- and only among candidates that are currently tied. This is the guard
  -- against admin overriding unambiguous results.
  SELECT r.state, r.tied_candidates
  INTO v_result
  FROM public.get_event_award_results(p_event_id) r
  WHERE r.award_type = p_award_type;

  IF v_result.state IS NULL OR v_result.state != 'tied' THEN
    RAISE EXCEPTION 'Acción no permitida';
  END IF;

  IF v_result.tied_candidates IS NULL
     OR NOT (p_chosen_id = ANY(v_result.tied_candidates)) THEN
    RAISE EXCEPTION 'Acción no permitida';
  END IF;

  INSERT INTO public.event_award_resolutions (event_id, award_type, player_id)
  VALUES (p_event_id, p_award_type, p_chosen_id)
  ON CONFLICT (event_id, award_type)
  DO UPDATE SET player_id = EXCLUDED.player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_event_award_tie(bigint, text, bigint) TO authenticated;


-- ─── 13. Public RPC: all resolved awards (for leaderboard) ────────────────
--
-- Used by useEventStats to aggregate historical award counts across all
-- events. Returns resolutions (authoritative) plus computed-unambiguous
-- winners from votes on events whose window has closed with no resolution.
-- Tied / no_votes categories are excluded (no winner means nothing to
-- count). Mid-window events are excluded by the window gate.

CREATE OR REPLACE FUNCTION get_resolved_event_awards()
RETURNS TABLE (event_id bigint, award_type text, player_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  -- Resolutions first (historical seed + admin tiebreakers).
  RETURN QUERY
    SELECT r.event_id, r.award_type, r.player_id
    FROM public.event_award_resolutions r;

  -- Computed winners for (event, award) pairs with votes, a closed window,
  -- and no resolution row. Tied / no_votes pairs yield NULL from
  -- _compute_award_winner.winner_id and are filtered out.
  RETURN QUERY
    SELECT pairs.event_id, pairs.award_type, w.winner_id
    FROM (
      SELECT DISTINCT v.event_id, v.award_type
      FROM public.event_award_votes v
    ) pairs
    JOIN public.events e ON e.id = pairs.event_id
    CROSS JOIN LATERAL public._compute_award_winner(pairs.event_id, pairs.award_type) w
    WHERE w.winner_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.event_award_resolutions r2
        WHERE r2.event_id = pairs.event_id AND r2.award_type = pairs.award_type
      )
      AND (
        ((e.played_at + e.played_at_time) AT TIME ZONE 'America/Argentina/Buenos_Aires')
        + interval '25 hours'
      ) < now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_resolved_event_awards() TO authenticated, anon;
