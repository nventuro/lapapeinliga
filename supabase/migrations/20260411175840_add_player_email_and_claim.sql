-- =============================================================================
-- Migration: Add player email linking and claim function
--
-- Allows players to link their Google account to their player profile via a
-- shared invite code. The email column is NOT exposed in the public view —
-- only admins querying the players table directly can see it.
-- =============================================================================

-- ─── 1. Add email column to players ─────────────────────────────────────────

ALTER TABLE players ADD COLUMN email text UNIQUE;

-- ─── 2. Create claim_player RPC (security definer) ──────────────────────────

CREATE OR REPLACE FUNCTION claim_player(secret text, target_player_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate the shared secret
  IF secret != 'racingcampeon' THEN
    RAISE EXCEPTION 'Código inválido';
  END IF;

  -- Check target player exists
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = target_player_id) THEN
    RAISE EXCEPTION 'Jugador no encontrado';
  END IF;

  -- Check target player isn't already claimed
  IF EXISTS (SELECT 1 FROM players WHERE id = target_player_id AND email IS NOT NULL) THEN
    RAISE EXCEPTION 'Este jugador ya tiene una cuenta vinculada';
  END IF;

  -- Check caller isn't already linked to another player
  IF EXISTS (SELECT 1 FROM players WHERE email = auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Tu cuenta ya está vinculada a otro jugador';
  END IF;

  -- Link the player
  UPDATE players SET email = auth.jwt() ->> 'email' WHERE id = target_player_id;
END;
$$;

-- Grant execute to authenticated users (anon cannot claim)
GRANT EXECUTE ON FUNCTION claim_player(text, bigint) TO authenticated;
