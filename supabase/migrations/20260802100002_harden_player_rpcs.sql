-- =============================================================================
-- Repin get_my_player_id / update_my_player_name and harden renaming.
--
-- 1. 20260622130000 pinned `search_path = ''` (with schema-qualified table
--    refs) on claim_player, calling it "the lone exception" — but these two
--    RPCs were missed: both still ran with `search_path = public`, which for a
--    SECURITY DEFINER function leaves name resolution partly caller-influenced.
--    Pin both to '' and fully qualify `public.players`.
--
-- 2. update_my_player_name also gains:
--      * an 80-char cap (MAX_PLAYER_NAME_LENGTH in src/types.ts; also enforced
--        at rest by players_name_length_check, see 20260802100001) with a clear
--        Spanish error instead of an opaque constraint failure, and
--      * a unique_violation handler so colliding with an existing player name
--        (players_name_unique, case-insensitive) raises a friendly Spanish
--        message instead of the raw English constraint error.
--    Behavior is otherwise unchanged.
-- =============================================================================


-- ─── 1. get_my_player_id: pin search_path ───────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_player_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM public.players
  WHERE email IS NOT NULL
    AND email = auth.jwt() ->> 'email'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_player_id() TO authenticated;


-- ─── 2. update_my_player_name: pin search_path, cap length, friendly errors ─

CREATE OR REPLACE FUNCTION update_my_player_name(new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  trimmed text := trim(new_name);
BEGIN
  IF trimmed = '' THEN
    RAISE EXCEPTION 'name cannot be empty';
  END IF;

  -- Keep in sync with MAX_PLAYER_NAME_LENGTH (src/types.ts) and the
  -- players_name_length_check constraint.
  IF char_length(trimmed) > 80 THEN
    RAISE EXCEPTION 'El nombre es demasiado largo';
  END IF;

  UPDATE public.players
  SET name = trimmed
  WHERE email = auth.jwt() ->> 'email';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no player linked to current user';
  END IF;
EXCEPTION
  WHEN unique_violation THEN
    -- players_name_unique is case-insensitive (unique index on lower(name)).
    RAISE EXCEPTION 'Ya existe un jugador con ese nombre';
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_player_name(text) TO authenticated;
