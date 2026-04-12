-- =============================================================================
-- Migration: Shorten vote window to 16 hours and expose voter count
--
-- 1. _event_vote_window: 24h → 16h
-- 2. get_event_award_window: add voter_count (distinct voters) to response
-- 3. get_resolved_event_awards: 25h → 17h (1h grace + 16h window)
-- =============================================================================


-- ─── 1. Shorten the voting window ──────────────────────────────────────────

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
  v_closes_at := v_opens_at + interval '16 hours';

  IF v_now < v_opens_at THEN
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'pending'::text;
  ELSIF v_now < v_closes_at THEN
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'open'::text;
  ELSE
    RETURN QUERY SELECT v_opens_at, v_closes_at, 'closed'::text;
  END IF;
END;
$$;


-- ─── 2. Add voter_count to the public window RPC ──────────────────────────

DROP FUNCTION IF EXISTS get_event_award_window(bigint);

CREATE OR REPLACE FUNCTION get_event_award_window(p_event_id bigint)
RETURNS TABLE (state text, opens_at timestamptz, closes_at timestamptz, voter_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    w.state,
    w.opens_at,
    w.closes_at,
    (SELECT COUNT(DISTINCT voter_player_id)
     FROM public.event_award_votes
     WHERE event_id = p_event_id)
  FROM public._event_vote_window(p_event_id) w;
$$;

GRANT EXECUTE ON FUNCTION get_event_award_window(bigint) TO authenticated, anon;


-- ─── 3. Update leaderboard gate to match new window duration ───────────────

CREATE OR REPLACE FUNCTION get_resolved_event_awards()
RETURNS TABLE (event_id bigint, award_type text, player_id bigint)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT r.event_id, r.award_type, r.player_id
    FROM public.event_award_resolutions r;

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
        + interval '17 hours'
      ) < now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_resolved_event_awards() TO authenticated, anon;
