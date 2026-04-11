-- =============================================================================
-- Migration: Add get_my_player_id RPC
--
-- Returns the id of the player linked to the caller's Google account, or null
-- if no such player exists. Used by non-admin users to detect their linked
-- player row without needing SELECT privilege on the players.email column,
-- which is deliberately restricted to admins.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_my_player_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM players
  WHERE email IS NOT NULL
    AND email = auth.jwt() ->> 'email'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_player_id() TO authenticated;
