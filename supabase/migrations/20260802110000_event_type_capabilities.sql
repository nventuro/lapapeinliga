-- =============================================================================
-- Event-type capabilities become data, not code.
--
-- The set of event types and what each one can do (award voting, participant
-- lists, finances) was scattered across a CHECK constraint on events.type and
-- a hardcoded allowlist repeated in three functions: `_event_vote_window`
-- (since 20260802100000 the single READ-side gate) plus the `cast_award_vote`
-- and `submit_event_feedback` write RPCs. Adding an event type meant touching
-- all of them and hoping none drifted.
--
-- Same cure as award_types (20260612120000): a reference table.
--   * event_types(type PK, votable, has_participants, has_finances) is the
--     canonical list; events.type becomes a foreign key to it.
--   * `_event_vote_window` derives its gate from `votable`.
--   * The write RPCs drop their type checks entirely: they already require
--     window state = 'open', and a non-votable type's window is always 'n/a',
--     so the votable gate now lives in exactly ONE place.
--
-- has_participants / has_finances are not yet consulted by any database code;
-- they document the capability matrix in the schema and back the client-side
-- mirror (hasParticipantList / hasFinances / hasAwards in src/types.ts, the
-- same pattern as AwardType vs award_types). Adding event type #6 costs one
-- row here plus one client union member.
-- =============================================================================


-- ─── 1. Canonical event-type table ──────────────────────────────────────────

CREATE TABLE event_types (
  type text PRIMARY KEY,
  votable boolean NOT NULL,
  has_participants boolean NOT NULL,
  has_finances boolean NOT NULL
);

INSERT INTO event_types (type, votable, has_participants, has_finances) VALUES
  ('match',          true,  true,  true),
  ('training',       false, true,  true),
  ('tournament',     true,  true,  true),
  ('external_match', false, true,  true),
  ('social',         false, false, false);

-- Same fail-closed stance as award_types: RLS on, zero policies. Only
-- SECURITY DEFINER functions (which run as the owner) read this table.
ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;

-- ─── 2. events.type: CHECK constraint becomes a foreign key ─────────────────

ALTER TABLE events
  DROP CONSTRAINT events_type_check,
  ADD CONSTRAINT events_type_fkey FOREIGN KEY (type) REFERENCES event_types (type);

-- ─── 3. _event_vote_window reads `votable` ──────────────────────────────────
--
-- Body identical to 20260802100000 except the hardcoded allowlist is replaced
-- by the event_types lookup.

CREATE OR REPLACE FUNCTION _event_vote_window(p_event_id bigint)
RETURNS TABLE (opens_at timestamptz, closes_at timestamptz, state text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_votable boolean;
  v_played_at date;
  v_played_at_time time;
  v_opens_at timestamptz;
  v_closes_at timestamptz;
  v_now timestamptz := now();
BEGIN
  SELECT et.votable, e.played_at, e.played_at_time
  INTO v_votable, v_played_at, v_played_at_time
  FROM public.events e
  JOIN public.event_types et ON et.type = e.type
  WHERE e.id = p_event_id;

  -- Unknown event or non-votable type: no window.
  IF v_votable IS DISTINCT FROM true THEN
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

-- ─── 4. Write RPCs stop echoing the allowlist ───────────────────────────────
--
-- Both already require `_event_vote_window(...).state = 'open'`, and 'n/a' is
-- never 'open', so their separate type checks were pure duplication. Bodies
-- are otherwise identical to 20260504120000 / 20260514120000.

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

  -- The votable-type gate lives inside _event_vote_window: non-votable (or
  -- nonexistent) events report 'n/a', which is never 'open'.
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

  -- The votable-type gate lives inside _event_vote_window (see cast_award_vote).
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
