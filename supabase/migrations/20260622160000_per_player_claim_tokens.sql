-- =============================================================================
-- Replace the single shared claim secret with per-player invite tokens.
--
-- The old claim_player(secret, target_player_id) used one static code
-- ('racingcampeon') committed to a PUBLIC repo: anyone with a Google account
-- could claim ANY unclaimed player (impersonation, ballot-stuffing, and — if an
-- admin had pre-assigned a role to an unlinked player — role escalation).
--
-- New model: an admin generates a unique, single-use token bound to ONE player
-- and sends that player the invite link. A token can only ever claim the one
-- player it was issued for, and is consumed on success. The token lives on the
-- players table, which is admin-only at the row level (see 20260622140000), so
-- it is never exposed to non-admins; the SECURITY DEFINER RPCs below read it as
-- the owner.
-- =============================================================================

ALTER TABLE players ADD COLUMN claim_token text;

-- ─── Admin: (re)issue a single-use claim token for an unclaimed player ──────
-- Returns the plaintext token so the admin can build the invite link. The
-- token is two concatenated UUIDs (~256 bits, no extension needed —
-- gen_random_uuid lives in pg_catalog, always on the search_path).

CREATE OR REPLACE FUNCTION generate_player_claim_token(p_player_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acción no permitida';
  END IF;

  IF EXISTS (SELECT 1 FROM public.players WHERE id = p_player_id AND email IS NOT NULL) THEN
    RAISE EXCEPTION 'Este jugador ya tiene una cuenta vinculada';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '')
           || replace(gen_random_uuid()::text, '-', '');

  UPDATE public.players SET claim_token = v_token WHERE id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jugador no encontrado';
  END IF;

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_player_claim_token(bigint) TO authenticated;

-- ─── Claim a player using its issued token ──────────────────────────────────
-- Replaces the old shared-secret signature. All token-related failures return a
-- single generic error so the function can't be used as an oracle for whether a
-- player exists / is already claimed / has a token.

DROP FUNCTION IF EXISTS claim_player(text, bigint);

CREATE OR REPLACE FUNCTION claim_player(p_player_id bigint, p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_stored_token text;
BEGIN
  v_email := auth.jwt() ->> 'email';
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  -- One player per account.
  IF EXISTS (SELECT 1 FROM public.players WHERE email = v_email) THEN
    RAISE EXCEPTION 'Tu cuenta ya está vinculada a otro jugador';
  END IF;

  -- Token must match the one issued for this specific, still-unclaimed player.
  SELECT claim_token INTO v_stored_token
  FROM public.players
  WHERE id = p_player_id AND email IS NULL;

  IF v_stored_token IS NULL OR p_token IS NULL OR v_stored_token IS DISTINCT FROM p_token THEN
    RAISE EXCEPTION 'Código inválido';
  END IF;

  -- Link and consume the token (single use).
  UPDATE public.players
  SET email = v_email, claim_token = NULL
  WHERE id = p_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_player(bigint, text) TO authenticated;
