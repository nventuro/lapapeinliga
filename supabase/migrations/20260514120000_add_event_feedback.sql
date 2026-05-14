-- =============================================================================
-- Migration: Anonymous post-event feedback
--
-- Players can leave one editable free-text comment per event during the same
-- window as award voting (matches/tournaments only). Authors can read & edit
-- their own comment while the window is open; nobody else sees comments
-- until the window closes, at which point admins (and only admins) can read
-- them — without any author identity exposed.
--
-- Access model mirrors event_award_votes: RLS enabled, ZERO policies, all
-- access through SECURITY DEFINER RPCs. voter_player_id is stored for
-- one-per-player dedup but is never returned by any RPC.
-- =============================================================================


-- ─── 1. Table ──────────────────────────────────────────────────────────────

CREATE TABLE event_feedback (
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  voter_player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  PRIMARY KEY (event_id, voter_player_id)
);

ALTER TABLE event_feedback ENABLE ROW LEVEL SECURITY;
-- NO POLICIES. All access through SECURITY DEFINER RPCs below.


-- ─── 2. Public RPC: submit (or update) feedback ───────────────────────────

CREATE OR REPLACE FUNCTION submit_event_feedback(
  p_event_id bigint,
  p_body text
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
  v_trimmed text;
BEGIN
  v_voter_email := auth.jwt() ->> 'email';
  IF v_voter_email IS NULL THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  SELECT id INTO v_voter_player_id
  FROM public.players
  WHERE email = v_voter_email;

  IF v_voter_player_id IS NULL THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  SELECT type INTO v_event_type FROM public.events WHERE id = p_event_id;
  IF v_event_type IS NULL OR v_event_type NOT IN ('match', 'tournament') THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  SELECT state INTO v_window_state FROM public._event_vote_window(p_event_id);
  IF v_window_state != 'open' THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id AND player_id = v_voter_player_id
  ) THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  v_trimmed := btrim(p_body);
  IF length(v_trimmed) = 0 OR length(v_trimmed) > 2000 THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  INSERT INTO public.event_feedback (event_id, voter_player_id, body)
  VALUES (p_event_id, v_voter_player_id, v_trimmed)
  ON CONFLICT (event_id, voter_player_id)
  DO UPDATE SET body = EXCLUDED.body;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_event_feedback(bigint, text) TO authenticated;


-- ─── 3. Public RPC: clear caller's own feedback ───────────────────────────

CREATE OR REPLACE FUNCTION clear_event_feedback(p_event_id bigint)
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
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  SELECT id INTO v_voter_player_id
  FROM public.players
  WHERE email = v_voter_email;

  IF v_voter_player_id IS NULL THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  SELECT state INTO v_window_state FROM public._event_vote_window(p_event_id);
  IF v_window_state != 'open' THEN
    RAISE EXCEPTION 'Comentario inválido';
  END IF;

  DELETE FROM public.event_feedback
  WHERE event_id = p_event_id
    AND voter_player_id = v_voter_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION clear_event_feedback(bigint) TO authenticated;


-- ─── 4. Public RPC: caller's own feedback (only while window is open) ─────

CREATE OR REPLACE FUNCTION get_my_event_feedback(p_event_id bigint)
RETURNS TABLE (body text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_voter_email text;
  v_voter_player_id bigint;
  v_window_state text;
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

  SELECT state INTO v_window_state FROM public._event_vote_window(p_event_id);
  IF v_window_state != 'open' THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT f.body
    FROM public.event_feedback f
    WHERE f.event_id = p_event_id
      AND f.voter_player_id = v_voter_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_event_feedback(bigint) TO authenticated;


-- ─── 5. Public RPC: admin reads anonymous feedback after close ────────────
--
-- Returns body only — voter_player_id is intentionally never exposed. Only
-- callable by admins, and only after the voting window has closed.

CREATE OR REPLACE FUNCTION get_event_feedback_admin(p_event_id bigint)
RETURNS TABLE (body text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_window_state text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acción no permitida';
  END IF;

  SELECT state INTO v_window_state FROM public._event_vote_window(p_event_id);
  IF v_window_state != 'closed' THEN
    RETURN;
  END IF;

  -- Order by random hash of the body so the row order doesn't correlate with
  -- insertion order (which could otherwise hint at who submitted what).
  RETURN QUERY
    SELECT f.body
    FROM public.event_feedback f
    WHERE f.event_id = p_event_id
    ORDER BY md5(f.body);
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_feedback_admin(bigint) TO authenticated;
