-- Address Supabase database linter findings.
--
-- Three classes of finding are fixed here; the rest are intentional and
-- documented at the bottom of this file.

-- ─── 1. ERROR: award_types RLS not enabled ────────────────────────────────
--
-- The table was created with no grants and no policies, relying on the
-- absence of table privileges to keep anon/authenticated out. The linter
-- still flags it because the table lives in the PostgREST-exposed `public`
-- schema. Enabling RLS with no policy makes the fail-closed intent explicit:
-- direct access is denied for everyone, and the SECURITY DEFINER RPCs that
-- read it run as the owner, bypassing RLS as before.

ALTER TABLE award_types ENABLE ROW LEVEL SECURITY;

-- ─── 2. WARN: claim_player has a role-mutable search_path ──────────────────
--
-- Every other function already pins `search_path`; claim_player was the lone
-- exception. Pin it to '' and fully-qualify the referenced table.

CREATE OR REPLACE FUNCTION claim_player(secret text, target_player_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Validate the shared secret
  IF secret != 'racingcampeon' THEN
    RAISE EXCEPTION 'Código inválido';
  END IF;

  -- Check target player exists
  IF NOT EXISTS (SELECT 1 FROM public.players WHERE id = target_player_id) THEN
    RAISE EXCEPTION 'Jugador no encontrado';
  END IF;

  -- Check target player isn't already claimed
  IF EXISTS (SELECT 1 FROM public.players WHERE id = target_player_id AND email IS NOT NULL) THEN
    RAISE EXCEPTION 'Este jugador ya tiene una cuenta vinculada';
  END IF;

  -- Check caller isn't already linked to another player
  IF EXISTS (SELECT 1 FROM public.players WHERE email = auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Tu cuenta ya está vinculada a otro jugador';
  END IF;

  -- Link the player
  UPDATE public.players SET email = auth.jwt() ->> 'email' WHERE id = target_player_id;
END;
$$;

-- ─── 3. WARN: internal SECURITY DEFINER functions executable via the API ───
--
-- Postgres grants EXECUTE to PUBLIC by default, which is why these show up as
-- callable by anon/authenticated over `/rest/v1/rpc/...`. None of them are a
-- public API:
--   * the _check_* and restrict_* functions are TRIGGER functions (triggers
--     fire regardless of EXECUTE privilege), and
--   * _compute_award_winner / _event_vote_window / _raise_if_participant_has_awards
--     are only ever called from inside other SECURITY DEFINER functions, which
--     run as the owner and so don't consult the caller's EXECUTE privilege.
-- Revoking the default grant removes them from the exposed API without
-- affecting any internal call.

REVOKE EXECUTE ON FUNCTION public._check_match_reserves_removal()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._check_match_team_player_removal()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._check_tournament_reserves_removal()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._check_tournament_team_player_removal()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._check_training_participant_removal()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._compute_award_winner(bigint, text)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._event_vote_window(bigint)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._raise_if_participant_has_awards(bigint, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_non_admin_to_winning_team_id_only() FROM PUBLIC, anon, authenticated;

-- ─── Intentionally NOT changed ─────────────────────────────────────────────
--
-- * WARN 0028/0029 on the remaining functions (cast_award_vote, claim_player,
--   get_*, current_user_role, submit_event_feedback, etc.): these ARE the
--   public/authenticated RPC API. They guard access internally (is_admin()
--   checks, auth.uid()/jwt scoping) and must stay callable. is_admin() and
--   is_mod_or_admin() additionally back nearly every RLS policy, so anon and
--   authenticated must retain EXECUTE on them. These warnings are advisory and
--   inherent to an RPC-based design.
-- * INFO 0008 (RLS enabled, no policy) on event_award_resolutions,
--   event_award_votes, event_feedback: intentional fail-closed state — all
--   access flows through SECURITY DEFINER RPCs.
-- * WARN auth_leaked_password_protection: a dashboard Auth setting, not
--   migratable. Moot here since login is Google OAuth only (no passwords), but
--   it can be toggled on under Auth → Providers if desired.
