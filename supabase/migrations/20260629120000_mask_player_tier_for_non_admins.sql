-- =============================================================================
-- Hide the core/sporadic tier distinction from non-admins.
--
-- `players_public` is the ONLY public window onto players — the base table is
-- RLS-locked to admins (see 20260622140000). Until now this view exposed every
-- player's real `tier` (core / sporadic / guest) to anon and to every signed-in
-- user. We want the core-vs-sporadic distinction to be visible ONLY to admins.
-- Everyone else (including moderators) may still see who is a guest, but core
-- and sporadic must be indistinguishable from each other.
--
-- This MUST be enforced in the view, not the frontend: the REST API is directly
-- queryable, so a value the client never receives is the only real boundary
-- (same lesson as 20260622140000). The view is security_invoker = false (runs
-- as its owner, bypassing players RLS), but `is_admin()` is SECURITY DEFINER
-- and reads the *caller's* JWT, so it still reflects who is actually asking even
-- while the view body runs as the owner.
--
-- Resulting `players_public.tier`:
--   admin         -> real tier (core / sporadic / guest)
--   everyone else -> 'guest' for guests, NULL for core/sporadic (masked)
--
-- Columns are unchanged (id, name, gender, tier), so the public column
-- allowlist in scripts/security-probe.sh still holds.
-- =============================================================================

DROP VIEW players_public;
CREATE VIEW players_public
  WITH (security_invoker = false)
  AS SELECT
    id,
    name,
    gender,
    CASE
      WHEN public.is_admin() THEN tier
      WHEN tier = 'guest'    THEN 'guest'
      ELSE NULL
    END AS tier
  FROM players;
GRANT SELECT ON players_public TO anon, authenticated;
