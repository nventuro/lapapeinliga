-- =============================================================================
-- Award window: report 'n/a' for every non-votable event type.
--
-- The write RPCs (cast_award_vote, submit_event_feedback) gate on a POSITIVE
-- allowlist — type IN ('match','tournament') — so voting/feedback are
-- fail-closed for any other type. But the READ side gated on the negative
-- `type = 'training'`: `_event_vote_window` and `get_event_award_results`
-- returned a real pending/open/closed window for 'external_match' and the new
-- 'social' type, so the UI showed a voting window (and eventually five
-- 'no_votes' results) for events where votes can never be cast.
--
-- Fix:
--   1. `_event_vote_window` returns 'n/a' whenever the type is NOT in the same
--      positive allowlist the write RPCs use, so a future fifth type is
--      fail-closed here too instead of silently growing a window.
--   2. `get_event_award_results` derives its n/a gate from the window state
--      instead of re-checking the type — `_event_vote_window` stays the single
--      source of truth (same principle as 20260622150000).
--
-- Both bodies are otherwise identical to their latest definitions
-- (20260503120000 and 20260612120000 respectively). `get_resolved_event_awards`
-- already asks `_event_vote_window` for state = 'closed', so it inherits the
-- fix ('n/a' is never 'closed') without changes.
-- =============================================================================


-- ─── 1. _event_vote_window: n/a unless type is votable ─────────────────────

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

  -- Positive allowlist, mirroring cast_award_vote / submit_event_feedback:
  -- anything not explicitly votable has no window.
  IF v_event_type IS NULL OR v_event_type NOT IN ('match', 'tournament') THEN
    RETURN QUERY SELECT NULL::timestamptz, NULL::timestamptz, 'n/a'::text;
    RETURN;
  END IF;

  v_opens_at := ((v_played_at + v_played_at_time) AT TIME ZONE 'America/Argentina/Buenos_Aires')
                + interval '1 hour';
  v_closes_at := v_opens_at + interval '5 hours';

  IF v_now < v_opens_at THEN
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'pending'::text;
  ELSIF v_now < v_closes_at THEN
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'open'::text;
  ELSE
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'closed'::text;
  END IF;
END;
$$;


-- ─── 2. get_event_award_results: derive the n/a gate from the window ────────

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
  v_resolution_player bigint;
  v_computed record;
BEGIN
  SELECT e.type INTO v_event_type FROM public.events e WHERE e.id = p_event_id;
  IF v_event_type IS NULL THEN
    RETURN;
  END IF;

  SELECT w.state INTO v_window_state FROM public._event_vote_window(p_event_id) w;

  -- No window means no awards for this event type: one 'n/a' row per award.
  IF v_window_state = 'n/a' THEN
    FOR v_award IN SELECT a.type FROM public.award_types a ORDER BY a.type LOOP
      RETURN QUERY SELECT v_award, 'n/a'::text, NULL::bigint, NULL::bigint[];
    END LOOP;
    RETURN;
  END IF;

  v_caller_is_admin := public.is_admin();

  FOR v_award IN SELECT a.type FROM public.award_types a ORDER BY a.type LOOP
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
