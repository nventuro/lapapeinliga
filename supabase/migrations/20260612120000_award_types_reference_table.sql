-- Make the set of award types a single source of truth.
--
-- Previously the award list was duplicated across: the CHECK constraints on
-- event_award_votes / event_award_resolutions, and a hardcoded array inside
-- get_event_award_results(). When 'brutality' was added it reached the
-- constraints but not the array, so brutality votes were stored yet never
-- surfaced as a winner. A reference table collapses these into one place:
-- the constraints become foreign keys and the function reads the list from
-- the table, so adding an award is a single INSERT and the three can no
-- longer drift apart.

-- ─── 1. Canonical award-type table ────────────────────────────────────────

CREATE TABLE award_types (type text PRIMARY KEY);

INSERT INTO award_types (type) VALUES
  ('top_scorer'),
  ('best_defense'),
  ('mvp'),
  ('best_goalie'),
  ('most_effort'),
  ('brutality');

-- No grants and no RLS policy: only the SECURITY DEFINER RPCs read this
-- table, so anon/authenticated have no direct access (fail-closed).

-- ─── 2. Replace the CHECK constraints with foreign keys ───────────────────

ALTER TABLE event_award_votes
  DROP CONSTRAINT event_award_votes_award_type_check,
  ADD CONSTRAINT event_award_votes_award_type_fkey
    FOREIGN KEY (award_type) REFERENCES award_types (type);

ALTER TABLE event_award_resolutions
  DROP CONSTRAINT event_award_resolutions_award_type_check,
  ADD CONSTRAINT event_award_resolutions_award_type_fkey
    FOREIGN KEY (award_type) REFERENCES award_types (type);

-- ─── 3. Clear stale brutality votes ───────────────────────────────────────
--
-- Brutality votes cast while results were unreachable are wiped so the award
-- starts fresh now that winners actually surface.

DELETE FROM event_award_votes WHERE award_type = 'brutality';
DELETE FROM event_award_resolutions WHERE award_type = 'brutality';

-- ─── 4. Drive get_event_award_results() from the table ────────────────────
--
-- Identical to the original except the hardcoded v_awards array is replaced
-- by a loop over award_types.

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

  IF v_event_type = 'training' THEN
    FOR v_award IN SELECT a.type FROM public.award_types a ORDER BY a.type LOOP
      RETURN QUERY SELECT v_award, 'n/a'::text, NULL::bigint, NULL::bigint[];
    END LOOP;
    RETURN;
  END IF;

  SELECT w.state INTO v_window_state FROM public._event_vote_window(p_event_id) w;
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
