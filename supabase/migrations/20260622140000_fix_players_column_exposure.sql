-- =============================================================================
-- CRITICAL FIX: players.email / rating / role were publicly readable.
--
-- Root cause: migration 20260302161430 added permissive RLS SELECT policies on
-- `players` for anon AND authenticated (`using (true)`) and switched
-- `players_public` to security_invoker, betting that COLUMN-LEVEL grants
-- (`grant select (id,name,gender,tier)`) would keep email/rating/role private.
--
-- That bet is wrong on Supabase. The anon/authenticated roles already hold a
-- broad table-level SELECT privilege (Supabase's default grants), so a
-- column-level grant is purely additive — it never restricts. With a
-- `using (true)` row policy on top, ANY caller (including logged-out `anon`)
-- could read every player's email, skill rating and role via
-- `/rest/v1/players?select=email,rating,role`. Verified live against prod.
--
-- The real (and only) confidentiality boundary on Supabase is RLS at the ROW
-- level — never column grants, because every signed-in user shares the single
-- `authenticated` Postgres role and grants cannot tell an admin from a basic
-- user. So sensitive columns must live behind a row policy that is false for
-- non-admins, with the public columns served through an owner-run view.
--
-- Fix:
--   1. Drop the two `using (true)` SELECT policies. The pre-existing
--      "Admins can select players" USING (is_admin()) becomes the ONLY SELECT
--      policy, so direct reads of `players` return zero rows to non-admins and
--      to anon (no anon SELECT policy at all).
--   2. Recreate `players_public` as a SECURITY DEFINER view (runs as its owner,
--      bypassing the now-restrictive players RLS) exposing ONLY the safe
--      columns. This keeps the public roster working for everyone with no
--      frontend change. The "security definer view" linter warning is the
--      correct, accepted trade-off here: the view is the intended, audited
--      surface and exposes no sensitive column.
--   3. Drop the misleading column-level grant so nobody mistakes it for a
--      security control again.
--
-- Admins (the `authenticated` role with is_admin() = true) keep full access via
-- the surviving policy + their existing table grant. All SECURITY DEFINER RPCs
-- (cast_award_vote, get_my_player_id, claim_player, …) read `players` as the
-- owner and are unaffected.
-- =============================================================================

-- ─── 1. Remove the permissive row policies ────────────────────────────────
DROP POLICY "Anon can select players" ON players;
DROP POLICY "Authenticated can select players" ON players;
-- Remaining SELECT policy: "Admins can select players" USING (is_admin()).

-- ─── 2. Public roster view runs as owner, safe columns only ────────────────
DROP VIEW players_public;
CREATE VIEW players_public
  WITH (security_invoker = false)
  AS SELECT id, name, gender, tier FROM players;
GRANT SELECT ON players_public TO anon, authenticated;

-- ─── 3. Drop the column grant that never protected anything ────────────────
REVOKE SELECT (id, name, gender, tier) ON players FROM anon, authenticated;
