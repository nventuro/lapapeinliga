-- =============================================================================
-- Migration: Allow mods to edit event participants
--
-- Loosens INSERT/DELETE on the 6 participant join tables so moderators can
-- add/remove/move participants across teams, reserves, attendees, and
-- coaches. Protects award integrity via deferred constraint triggers: a
-- participant holding a resolved award or having votes as a candidate on the
-- event cannot be removed, but can freely be *moved* between destinations
-- (the participant set is invariant under moves).
--
-- Enforcement runs at transaction commit (DEFERRABLE INITIALLY DEFERRED),
-- so a UI "move" implemented as insert-then-delete passes naturally: at the
-- commit of the DELETE, the player is already a participant via the INSERT.
-- =============================================================================

-- ─── 1. Loosen INSERT/DELETE policies to is_mod_or_admin() ──────────────────

-- match_team_players
DROP POLICY "Admins can insert match_team_players" ON match_team_players;
DROP POLICY "Admins can delete match_team_players" ON match_team_players;
CREATE POLICY "Mods can insert match_team_players" ON match_team_players
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete match_team_players" ON match_team_players
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- match_reserves
DROP POLICY "Admins can insert match_reserves" ON match_reserves;
DROP POLICY "Admins can delete match_reserves" ON match_reserves;
CREATE POLICY "Mods can insert match_reserves" ON match_reserves
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete match_reserves" ON match_reserves
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- training_attendees
DROP POLICY "Admins can insert training_attendees" ON training_attendees;
DROP POLICY "Admins can delete training_attendees" ON training_attendees;
CREATE POLICY "Mods can insert training_attendees" ON training_attendees
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete training_attendees" ON training_attendees
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- training_coaches
DROP POLICY "Admins can insert training_coaches" ON training_coaches;
DROP POLICY "Admins can delete training_coaches" ON training_coaches;
CREATE POLICY "Mods can insert training_coaches" ON training_coaches
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete training_coaches" ON training_coaches
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- tournament_team_players
DROP POLICY "Admins can insert tournament_team_players" ON tournament_team_players;
DROP POLICY "Admins can delete tournament_team_players" ON tournament_team_players;
CREATE POLICY "Mods can insert tournament_team_players" ON tournament_team_players
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete tournament_team_players" ON tournament_team_players
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- tournament_reserves
DROP POLICY "Admins can insert tournament_reserves" ON tournament_reserves;
DROP POLICY "Admins can delete tournament_reserves" ON tournament_reserves;
CREATE POLICY "Mods can insert tournament_reserves" ON tournament_reserves
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete tournament_reserves" ON tournament_reserves
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- ─── 2. Shared integrity check ──────────────────────────────────────────────
--
-- Raises if the player would be orphaned on this event while still holding a
-- resolved award or having received votes as a candidate. A player who is
-- still in `event_participants` (via any join table) is considered "moved,
-- not removed" and the check is a no-op. Runs as SECURITY DEFINER so it can
-- read the RLS-locked event_award_* tables.

CREATE OR REPLACE FUNCTION _raise_if_participant_has_awards(
  p_event_id bigint, p_player_id bigint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Still a participant via another table? Then this was a move.
  IF EXISTS (
    SELECT 1 FROM public.event_participants
    WHERE event_id = p_event_id AND player_id = p_player_id
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_award_resolutions
    WHERE event_id = p_event_id AND player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'No se puede quitar: el jugador ganó un premio en esta fecha';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_award_votes
    WHERE event_id = p_event_id AND candidate_player_id = p_player_id
  ) THEN
    RAISE EXCEPTION 'No se puede quitar: el jugador recibió votos en esta fecha';
  END IF;
END;
$$;

-- ─── 3. Per-table trigger functions (resolve event_id, then check) ──────────

CREATE OR REPLACE FUNCTION _check_match_team_player_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_event_id bigint;
BEGIN
  SELECT m.event_id INTO v_event_id
  FROM public.match_teams mt JOIN public.matches m ON m.id = mt.match_id
  WHERE mt.id = OLD.match_team_id;
  IF v_event_id IS NOT NULL THEN
    PERFORM public._raise_if_participant_has_awards(v_event_id, OLD.player_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION _check_match_reserves_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_event_id bigint;
BEGIN
  SELECT event_id INTO v_event_id FROM public.matches WHERE id = OLD.match_id;
  IF v_event_id IS NOT NULL THEN
    PERFORM public._raise_if_participant_has_awards(v_event_id, OLD.player_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION _check_training_participant_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_event_id bigint;
BEGIN
  SELECT event_id INTO v_event_id FROM public.trainings WHERE id = OLD.training_id;
  IF v_event_id IS NOT NULL THEN
    PERFORM public._raise_if_participant_has_awards(v_event_id, OLD.player_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION _check_tournament_team_player_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_event_id bigint;
BEGIN
  SELECT t.event_id INTO v_event_id
  FROM public.tournament_teams tt JOIN public.tournaments t ON t.id = tt.tournament_id
  WHERE tt.id = OLD.tournament_team_id;
  IF v_event_id IS NOT NULL THEN
    PERFORM public._raise_if_participant_has_awards(v_event_id, OLD.player_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION _check_tournament_reserves_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_event_id bigint;
BEGIN
  SELECT event_id INTO v_event_id FROM public.tournaments WHERE id = OLD.tournament_id;
  IF v_event_id IS NOT NULL THEN
    PERFORM public._raise_if_participant_has_awards(v_event_id, OLD.player_id);
  END IF;
  RETURN NULL;
END;
$$;

-- ─── 4. Attach as DEFERRABLE INITIALLY DEFERRED constraint triggers ─────────
--
-- Constraint triggers fire at transaction commit, so a UI move implemented
-- as insert-then-delete passes the check naturally: by the time the DELETE
-- commits, the player is already a participant via the INSERT.

CREATE CONSTRAINT TRIGGER check_match_team_player_removal
  AFTER DELETE ON match_team_players
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _check_match_team_player_removal();

CREATE CONSTRAINT TRIGGER check_match_reserves_removal
  AFTER DELETE ON match_reserves
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _check_match_reserves_removal();

CREATE CONSTRAINT TRIGGER check_training_attendees_removal
  AFTER DELETE ON training_attendees
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _check_training_participant_removal();

CREATE CONSTRAINT TRIGGER check_training_coaches_removal
  AFTER DELETE ON training_coaches
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _check_training_participant_removal();

CREATE CONSTRAINT TRIGGER check_tournament_team_player_removal
  AFTER DELETE ON tournament_team_players
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _check_tournament_team_player_removal();

CREATE CONSTRAINT TRIGGER check_tournament_reserves_removal
  AFTER DELETE ON tournament_reserves
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _check_tournament_reserves_removal();
