-- =============================================================================
-- Migration: Allow external-match reserves to score goals
--
-- A reserve who comes off the bench can score, so reserves get the same goals
-- column the starting roster already has, plus an admin UPDATE policy to edit
-- it (mirrors external_match_players, where goals editing is admin-only).
-- =============================================================================

ALTER TABLE external_match_reserves
  ADD COLUMN goals integer NOT NULL DEFAULT 0 CHECK (goals >= 0);

CREATE POLICY "Admins can update external_match_reserves" ON external_match_reserves
  FOR UPDATE TO authenticated USING (is_admin());
