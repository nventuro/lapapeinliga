-- =============================================================================
-- Deleting a player must not silently erase their history.
--
-- `event_award_resolutions.player_id` went ON DELETE RESTRICT in 20260802100001
-- so a resolved award could never vanish with the player who won it. Every
-- OTHER trace of a player still CASCADEd: their roster rows and their photo
-- tags disappeared without a word. On live data that is not hypothetical —
-- 39 of 56 players hold an award and are already protected, but 16 of the
-- remaining 17 have real history (up to 6 appearances and 5 photo tags) that
-- one confirm dialog would have wiped.
--
-- The fix is the cheap one, not soft-delete. Soft-delete (players.deleted_at)
-- would tax every player query, the players_public view, the roster UI and the
-- unique-name constraint, forever — and it solves a problem nobody has
-- (deleting someone while KEEPING their history). The actual problem is that
-- the erasure is SILENT. RESTRICT makes it loud: the delete is refused and the
-- admin has to deal with the history deliberately, exactly as awards already
-- behave.
--
-- Not changed, deliberately:
--   * event_award_votes / event_feedback — ballots, not history, and
--     deliberately anonymous. A player who only ever voted still deletes.
--   * player_preferences — team-sorter configuration, not a record of anything
--     that happened.
-- =============================================================================


-- ─── 1. History-bearing references become RESTRICT ──────────────────────────

ALTER TABLE event_participants
  DROP CONSTRAINT event_participants_player_id_fkey,
  ADD CONSTRAINT event_participants_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE RESTRICT;

ALTER TABLE media_player_tags
  DROP CONSTRAINT media_player_tags_player_id_fkey,
  ADD CONSTRAINT media_player_tags_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE RESTRICT;


-- ─── 2. A readable reason instead of a raw constraint violation ─────────────
--
-- PlantelPage surfaces `error.message` straight into an alert, so without this
-- an admin would read an English Postgres FK error in an otherwise Spanish
-- app. BEFORE DELETE fires ahead of the constraint, so this message wins.
--
-- This is an INTEGRITY check, not a permission check: it never calls
-- is_admin(), so unlike a role-based trigger it cannot reject migrations or
-- service-role writes (the trap documented in 20260802110001). SECURITY
-- DEFINER only so it can read the RLS-locked award tables.

CREATE OR REPLACE FUNCTION _explain_player_delete_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_events bigint;
  v_photos bigint;
  v_awards bigint;
  v_reasons text[] := '{}';
BEGIN
  SELECT count(*) INTO v_events
  FROM public.event_participants WHERE player_id = OLD.id;

  SELECT count(*) INTO v_photos
  FROM public.media_player_tags WHERE player_id = OLD.id;

  SELECT count(*) INTO v_awards
  FROM public.event_award_resolutions WHERE player_id = OLD.id;

  -- Phrasing stays gender-neutral on purpose: the player's grammatical gender
  -- is not knowable from players.gender for every name, and "quitalo" would be
  -- wrong for half the roster. Hence "tiene N etiquetas" over "está etiquetado".
  IF v_awards > 0 THEN
    v_reasons := v_reasons || format('ganó %s premio%s', v_awards, CASE WHEN v_awards = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_events > 0 THEN
    v_reasons := v_reasons || format('participó en %s fecha%s', v_events, CASE WHEN v_events = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_photos > 0 THEN
    v_reasons := v_reasons || format('tiene %s etiqueta%s en fotos', v_photos, CASE WHEN v_photos = 1 THEN '' ELSE 's' END);
  END IF;

  IF array_length(v_reasons, 1) > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar a % porque %. Primero quitá esos registros.',
      OLD.name, array_to_string(v_reasons, ', ');
  END IF;

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._explain_player_delete_block() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER explain_player_delete_block
  BEFORE DELETE ON players FOR EACH ROW
  EXECUTE FUNCTION _explain_player_delete_block();
