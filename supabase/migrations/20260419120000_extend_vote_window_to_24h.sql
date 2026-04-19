-- =============================================================================
-- Migration: Extend vote window from 16 hours back to 24 hours
--
-- 1. _event_vote_window: 16h → 24h
-- 2. get_resolved_event_awards: 17h → 25h (1h grace + 24h window)
-- =============================================================================


-- ─── 1. Extend the voting window ───────────────────────────────────────────

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


-- ─── 2. Update leaderboard gate to match new window duration ───────────────

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
        + interval '25 hours'
      ) < now();
END;
$$;

GRANT EXECUTE ON FUNCTION get_resolved_event_awards() TO authenticated, anon;
