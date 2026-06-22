-- =============================================================================
-- De-duplicate the vote-window duration and drop dead code.
--
-- 1. The voting-window length lived in TWO places that had to be hand-synced on
--    every change: `_event_vote_window` (which derives open/closed state) and a
--    hardcoded `+ interval 'N hours'` inside `get_resolved_event_awards` (the
--    leaderboard gate). If the leaderboard interval were ever shorter than the
--    real window, computed winners would leak before voting closed. Make
--    `_event_vote_window` the single source of truth: the leaderboard gate now
--    asks it for state = 'closed' instead of re-deriving the cutoff.
--
-- 2. `is_admin_email` became dead code once `is_admin()` switched to the
--    role table (20260417120000) and `cast_award_vote` stopped recording
--    voter_is_admin (20260504120000). Nothing references it anymore; drop it
--    (it also still carried the legacy hardcoded admin email list).
-- =============================================================================

-- ─── 1. Drive the leaderboard gate off _event_vote_window ──────────────────

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

  -- Computed winners for (event, award) pairs with votes, a CLOSED window, and
  -- no resolution row. The window state comes straight from _event_vote_window
  -- so it can never drift from the live voting window.
  RETURN QUERY
    SELECT pairs.event_id, pairs.award_type, w.winner_id
    FROM (
      SELECT DISTINCT v.event_id, v.award_type
      FROM public.event_award_votes v
    ) pairs
    CROSS JOIN LATERAL public._compute_award_winner(pairs.event_id, pairs.award_type) w
    CROSS JOIN LATERAL public._event_vote_window(pairs.event_id) win
    WHERE w.winner_id IS NOT NULL
      AND win.state = 'closed'
      AND NOT EXISTS (
        SELECT 1 FROM public.event_award_resolutions r2
        WHERE r2.event_id = pairs.event_id AND r2.award_type = pairs.award_type
      );
END;
$$;

GRANT EXECUTE ON FUNCTION get_resolved_event_awards() TO authenticated, anon;

-- ─── 2. Drop dead code ─────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS is_admin_email(text);
