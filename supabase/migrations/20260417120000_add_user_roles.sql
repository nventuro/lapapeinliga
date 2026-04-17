-- =============================================================================
-- Migration: Add user roles (basic / moderator / admin)
--
-- Roles live on the players table. A player's role is active only when their
-- email is linked (via claim_player) and they sign in with a matching Google
-- account — otherwise the role sits dormant.
--
-- Replaces the email-allowlist `is_admin()` with a table-driven lookup, and
-- introduces `is_mod_or_admin()` for post-match write capabilities.
-- =============================================================================

-- ─── 1. Add role column + seed existing admins ───────────────────────────────

ALTER TABLE players
  ADD COLUMN role text NOT NULL DEFAULT 'basic'
  CHECK (role IN ('basic', 'moderator', 'admin'));

UPDATE players SET role = 'admin'
  WHERE email IN ('nicolas.venturo@gmail.com', 'gustavobarbaresi@gmail.com');

-- NOTE: `role` is intentionally NOT added to the anon/authenticated column
-- grants on players (see 20260302161430), so non-admins cannot enumerate who
-- holds which role. Admins query the full `players` table directly.

-- ─── 2. Role helper functions ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.players WHERE email = auth.jwt() ->> 'email'),
    'basic'
  )
$$;

-- Rewrite is_admin() to read from the table instead of the hardcoded list.
-- Keeping the name + signature means every existing RLS policy referencing it
-- continues to work unchanged.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$ SELECT public.current_user_role() = 'admin' $$;

CREATE OR REPLACE FUNCTION is_mod_or_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$ SELECT public.current_user_role() IN ('moderator', 'admin') $$;

GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_mod_or_admin() TO authenticated;

-- ─── 3. Loosen tournament_matches to mods ────────────────────────────────────

DROP POLICY "Admins can insert tournament_matches" ON tournament_matches;
DROP POLICY "Admins can update tournament_matches" ON tournament_matches;
DROP POLICY "Admins can delete tournament_matches" ON tournament_matches;

CREATE POLICY "Mods can insert tournament_matches" ON tournament_matches
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can update tournament_matches" ON tournament_matches
  FOR UPDATE TO authenticated USING (is_mod_or_admin());
CREATE POLICY "Mods can delete tournament_matches" ON tournament_matches
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- ─── 4. Loosen matches + tournaments UPDATE to mods (column-restricted) ──────

DROP POLICY "Admins can update matches" ON matches;
CREATE POLICY "Mods can update matches" ON matches
  FOR UPDATE TO authenticated USING (is_mod_or_admin());

DROP POLICY "Admins can update tournaments" ON tournaments;
CREATE POLICY "Mods can update tournaments" ON tournaments
  FOR UPDATE TO authenticated USING (is_mod_or_admin());

-- Reusable trigger: non-admins may update only `winning_team_id`. Using
-- `to_jsonb(NEW) - 'winning_team_id'` compares all-columns-except-one without
-- enumerating them — any new column added later defaults to admin-only edit.
CREATE OR REPLACE FUNCTION restrict_non_admin_to_winning_team_id_only()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_admin() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'winning_team_id') IS DISTINCT FROM
     (to_jsonb(OLD) - 'winning_team_id') THEN
    RAISE EXCEPTION 'Solo el administrador puede modificar otros campos';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER restrict_mod_updates_matches
  BEFORE UPDATE ON matches FOR EACH ROW
  EXECUTE FUNCTION restrict_non_admin_to_winning_team_id_only();

CREATE TRIGGER restrict_mod_updates_tournaments
  BEFORE UPDATE ON tournaments FOR EACH ROW
  EXECUTE FUNCTION restrict_non_admin_to_winning_team_id_only();
