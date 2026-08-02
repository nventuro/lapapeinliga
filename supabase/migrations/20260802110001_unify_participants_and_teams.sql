-- =============================================================================
-- Collapse the per-type event plumbing into two unified tables.
--
-- The five event types were implemented as parallel copy-pasted plumbing:
-- eight roster junction tables (match_team_players, match_reserves,
-- training_attendees, training_coaches, tournament_team_players,
-- tournament_reserves, external_match_players, external_match_reserves), two
-- team tables differing only by shirt_color, five near-identical removal-check
-- trigger functions, an 8-branch UNION view, and three detail tables (matches,
-- trainings, tournaments) that after earlier refactors carried nothing but a
-- winning_team_id (or, for trainings, nothing at all). Adding a
-- participant-bearing event type touched ~7 database objects.
--
-- After this migration:
--   * event_participants is a TABLE keyed (event_id, player_id) with a `kind`
--     ('team_member' | 'reserve' | 'attendee' | 'coach'), an optional team, and
--     per-player goals (meaningful for external matches). It replaces the eight
--     junction tables AND the same-named view — every function that read the
--     view (vote weighting, candidate checks, award-removal guard) keeps
--     working unchanged against the table.
--   * event_teams replaces match_teams + tournament_teams, keyed by event_id
--     directly, with UNIQUE (event_id, id) so winner/fixture/roster FKs are
--     composite ("this team belongs to this event" — the 20260802100001
--     pattern). shirt_color is NULL for teams that don't track one.
--   * The winner moves to events.winning_team_id; matches, trainings and
--     tournaments are dropped. (external_matches stays: opponent + scores are
--     real per-type data.) The mods-can-only-set-the-winner update trigger
--     moves from matches/tournaments to events.
--   * tournament_matches fixtures re-key from tournament_id to event_id.
--   * ONE removal-integrity trigger replaces the five per-table ones. A roster
--     "move" is now an UPDATE of kind/team_id on one row — it cannot orphan an
--     awarded participant by construction, so the deferred trigger only needs
--     to guard DELETE and identity (event_id/player_id) updates.
--
-- Deviation from the staged plan ("drop old tables a deploy cycle later"):
-- everything pending deploys in a single `db push`, so a later drop migration
-- would land in the same batch anyway. Instead the backfill and the drops
-- share this migration's transaction, and count assertions abort the whole
-- thing on any mismatch. Live data was probed on 2026-08-01: 516 roster rows,
-- all (event_id, player_id)-distinct, so the new primary key is satisfiable.
--
-- Permission change (conscious): mods gain UPDATE on event_participants.
-- Moves between kinds/teams are now single-row UPDATEs and mods must be able
-- to perform them. This incidentally lets mods edit `goals` directly, which
-- was nominally admin-only — but mods could already set goals via the
-- insert/delete policies they held (goals rides along on INSERT), so no
-- practical privilege is gained.
-- =============================================================================


-- ─── 1. Unified teams table ─────────────────────────────────────────────────

CREATE TABLE event_teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) > 0),
  -- NULL for teams that don't track a shirt color (tournaments).
  shirt_color text CHECK (shirt_color IN ('light', 'dark')),
  -- Composite key so referencing FKs can enforce same-event integrity.
  CONSTRAINT event_teams_event_id_id_key UNIQUE (event_id, id)
);
-- event_id needs no separate index: the UNIQUE above covers it as leading column.

-- Temporary backfill-mapping column: old ids from match_teams and
-- tournament_teams overlap, so rows are correlated through a tagged source
-- key instead. Dropped at the end of this migration.
ALTER TABLE event_teams ADD COLUMN _src text;

INSERT INTO event_teams (event_id, name, shirt_color, _src)
  SELECT m.event_id, mt.name, mt.shirt_color, 'match:' || mt.id
  FROM match_teams mt
  JOIN matches m ON m.id = mt.match_id;

INSERT INTO event_teams (event_id, name, _src)
  SELECT t.event_id, tt.name, 'tournament:' || tt.id
  FROM tournament_teams tt
  JOIN tournaments t ON t.id = tt.tournament_id;

-- ─── 2. Unified participants table (replaces the view of the same name) ─────

DROP VIEW event_participants;

CREATE TABLE event_participants (
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('team_member', 'reserve', 'attendee', 'coach')),
  -- Only team members can sit on a team; a team_member row MAY have no team
  -- (external matches: our whole roster plays, with no internal team split).
  team_id bigint,
  goals integer NOT NULL DEFAULT 0 CHECK (goals >= 0),
  PRIMARY KEY (event_id, player_id),
  CONSTRAINT event_participants_team_id_fkey
    FOREIGN KEY (event_id, team_id) REFERENCES event_teams (event_id, id) ON DELETE CASCADE,
  CONSTRAINT event_participants_team_kind_check
    CHECK (team_id IS NULL OR kind = 'team_member')
);

CREATE INDEX event_participants_player_id_idx ON event_participants (player_id);
CREATE INDEX event_participants_team_id_idx ON event_participants (event_id, team_id);

-- Backfill. Plain INSERTs (no ON CONFLICT): a player recorded twice for one
-- event would violate the new primary key and abort the migration loudly
-- instead of silently picking a kind.

INSERT INTO event_participants (event_id, player_id, kind, team_id)
  SELECT m.event_id, mtp.player_id, 'team_member', nt.id
  FROM match_team_players mtp
  JOIN match_teams mt ON mt.id = mtp.match_team_id
  JOIN matches m ON m.id = mt.match_id
  JOIN event_teams nt ON nt._src = 'match:' || mt.id;

INSERT INTO event_participants (event_id, player_id, kind)
  SELECT m.event_id, mr.player_id, 'reserve'
  FROM match_reserves mr
  JOIN matches m ON m.id = mr.match_id;

INSERT INTO event_participants (event_id, player_id, kind)
  SELECT t.event_id, ta.player_id, 'attendee'
  FROM training_attendees ta
  JOIN trainings t ON t.id = ta.training_id;

INSERT INTO event_participants (event_id, player_id, kind)
  SELECT t.event_id, tc.player_id, 'coach'
  FROM training_coaches tc
  JOIN trainings t ON t.id = tc.training_id;

INSERT INTO event_participants (event_id, player_id, kind, team_id)
  SELECT tn.event_id, ttp.player_id, 'team_member', nt.id
  FROM tournament_team_players ttp
  JOIN tournament_teams tt ON tt.id = ttp.tournament_team_id
  JOIN tournaments tn ON tn.id = tt.tournament_id
  JOIN event_teams nt ON nt._src = 'tournament:' || tt.id;

INSERT INTO event_participants (event_id, player_id, kind)
  SELECT tn.event_id, tr.player_id, 'reserve'
  FROM tournament_reserves tr
  JOIN tournaments tn ON tn.id = tr.tournament_id;

INSERT INTO event_participants (event_id, player_id, kind, goals)
  SELECT em.event_id, emp.player_id, 'team_member', emp.goals
  FROM external_match_players emp
  JOIN external_matches em ON em.id = emp.external_match_id;

INSERT INTO event_participants (event_id, player_id, kind, goals)
  SELECT em.event_id, emr.player_id, 'reserve', emr.goals
  FROM external_match_reserves emr
  JOIN external_matches em ON em.id = emr.external_match_id;

-- ─── 3. Winner moves onto events ────────────────────────────────────────────

ALTER TABLE events ADD COLUMN winning_team_id bigint;

UPDATE events e SET winning_team_id = nt.id
  FROM matches m
  JOIN event_teams nt ON nt._src = 'match:' || m.winning_team_id
  WHERE m.event_id = e.id AND m.winning_team_id IS NOT NULL;

UPDATE events e SET winning_team_id = nt.id
  FROM tournaments t
  JOIN event_teams nt ON nt._src = 'tournament:' || t.winning_team_id
  WHERE t.event_id = e.id AND t.winning_team_id IS NOT NULL;

-- The winner must be a team of THIS event (composite FK through the
-- UNIQUE (event_id, id) key; MATCH SIMPLE skips the check while NULL).
ALTER TABLE events
  ADD CONSTRAINT events_winning_team_id_fkey
  FOREIGN KEY (id, winning_team_id) REFERENCES event_teams (event_id, id)
  ON DELETE SET NULL (winning_team_id);

-- Mods could previously set the winner on matches/tournaments: those tables
-- had a mod-level UPDATE policy plus `restrict_non_admin_to_winning_team_id_only`,
-- a BEFORE UPDATE trigger rejecting non-admin edits to any other column.
--
-- That arrangement is NOT recreated on events, because the trigger fires for
-- EVERY writer — including the table owner, who bypasses RLS. `is_admin()`
-- reads the caller's JWT, which a migration or any service-role connection
-- does not have, so an events-wide trigger would reject maintenance UPDATEs
-- outright (the location dedup in 20260802110002 is exactly such an UPDATE).
-- It never bit matches/tournaments only because nothing ever bulk-updated them.
--
-- Instead the winner gets a SECURITY DEFINER RPC, the same shape every other
-- mod/player-scoped write already uses (cast_award_vote, submit_event_feedback,
-- update_my_player_name). events keeps its admin-only UPDATE policy, so a
-- non-admin has no direct write path to any column.

CREATE OR REPLACE FUNCTION set_event_winner(p_event_id bigint, p_team_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_mod_or_admin() THEN
    RAISE EXCEPTION 'Acción no permitida';
  END IF;

  -- NULL clears the winner. A non-NULL team must belong to this event; the
  -- composite FK enforces that too, but checking here returns a message in
  -- the app's language instead of a raw constraint violation.
  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_teams WHERE id = p_team_id AND event_id = p_event_id
  ) THEN
    RAISE EXCEPTION 'El equipo no pertenece a esta fecha';
  END IF;

  UPDATE public.events SET winning_team_id = p_team_id WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_event_winner(bigint, bigint) TO authenticated;

-- ─── 4. Tournament fixtures re-key to the event ─────────────────────────────

ALTER TABLE tournament_matches
  DROP CONSTRAINT tournament_matches_team_a_id_fkey,
  DROP CONSTRAINT tournament_matches_team_b_id_fkey,
  ADD COLUMN event_id bigint;

UPDATE tournament_matches tm
  SET event_id = t.event_id,
      team_a_id = nta.id,
      team_b_id = ntb.id
  FROM tournaments t, event_teams nta, event_teams ntb
  WHERE t.id = tm.tournament_id
    AND nta._src = 'tournament:' || tm.team_a_id
    AND ntb._src = 'tournament:' || tm.team_b_id;

-- A row the remap skipped would keep event_id NULL and fail right here.
ALTER TABLE tournament_matches
  ALTER COLUMN event_id SET NOT NULL,
  ADD CONSTRAINT tournament_matches_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  ADD CONSTRAINT tournament_matches_team_a_id_fkey
    FOREIGN KEY (event_id, team_a_id) REFERENCES event_teams (event_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT tournament_matches_team_b_id_fkey
    FOREIGN KEY (event_id, team_b_id) REFERENCES event_teams (event_id, id) ON DELETE CASCADE;

-- Serve the two composite FKs and cover event_id as their leading column
-- (replaces the (tournament_id, team_*) pair, which dies with the column).
CREATE INDEX tournament_matches_event_id_team_a_id_idx ON tournament_matches (event_id, team_a_id);
CREATE INDEX tournament_matches_event_id_team_b_id_idx ON tournament_matches (event_id, team_b_id);

ALTER TABLE tournament_matches DROP COLUMN tournament_id;

-- ─── 5. Backfill assertions ─────────────────────────────────────────────────
--
-- Any mismatch aborts the transaction, keeping the old tables and data intact.

DO $$
DECLARE
  v_src bigint;
  v_dst bigint;
BEGIN
  SELECT (SELECT count(*) FROM match_teams) + (SELECT count(*) FROM tournament_teams) INTO v_src;
  SELECT count(*) FROM event_teams INTO v_dst;
  IF v_dst <> v_src THEN
    RAISE EXCEPTION 'event_teams backfill mismatch: % source rows, % copied', v_src, v_dst;
  END IF;

  SELECT (SELECT count(*) FROM match_team_players)
       + (SELECT count(*) FROM tournament_team_players)
       + (SELECT count(*) FROM external_match_players) INTO v_src;
  SELECT count(*) FROM event_participants WHERE kind = 'team_member' INTO v_dst;
  IF v_dst <> v_src THEN
    RAISE EXCEPTION 'team_member backfill mismatch: % source rows, % copied', v_src, v_dst;
  END IF;

  SELECT (SELECT count(*) FROM match_reserves)
       + (SELECT count(*) FROM tournament_reserves)
       + (SELECT count(*) FROM external_match_reserves) INTO v_src;
  SELECT count(*) FROM event_participants WHERE kind = 'reserve' INTO v_dst;
  IF v_dst <> v_src THEN
    RAISE EXCEPTION 'reserve backfill mismatch: % source rows, % copied', v_src, v_dst;
  END IF;

  SELECT count(*) FROM training_attendees INTO v_src;
  SELECT count(*) FROM event_participants WHERE kind = 'attendee' INTO v_dst;
  IF v_dst <> v_src THEN
    RAISE EXCEPTION 'attendee backfill mismatch: % source rows, % copied', v_src, v_dst;
  END IF;

  SELECT count(*) FROM training_coaches INTO v_src;
  SELECT count(*) FROM event_participants WHERE kind = 'coach' INTO v_dst;
  IF v_dst <> v_src THEN
    RAISE EXCEPTION 'coach backfill mismatch: % source rows, % copied', v_src, v_dst;
  END IF;

  SELECT (SELECT count(*) FROM matches WHERE winning_team_id IS NOT NULL)
       + (SELECT count(*) FROM tournaments WHERE winning_team_id IS NOT NULL) INTO v_src;
  SELECT count(*) FROM events WHERE winning_team_id IS NOT NULL INTO v_dst;
  IF v_dst <> v_src THEN
    RAISE EXCEPTION 'winner backfill mismatch: % source rows, % copied', v_src, v_dst;
  END IF;
END $$;

-- ─── 6. RLS ─────────────────────────────────────────────────────────────────

-- event_teams: everyone reads; team management (create/rename/recolor/delete)
-- stays admin-only, as it was on match_teams / tournament_teams.
ALTER TABLE event_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select event_teams" ON event_teams FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select event_teams" ON event_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert event_teams" ON event_teams FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update event_teams" ON event_teams FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete event_teams" ON event_teams FOR DELETE TO authenticated USING (is_admin());

-- event_participants: everyone reads; mods manage rosters. UPDATE is the move
-- operation now (kind/team_id) — see the header note on the goals implication.
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select event_participants" ON event_participants FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select event_participants" ON event_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mods can insert event_participants" ON event_participants FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can update event_participants" ON event_participants FOR UPDATE TO authenticated USING (is_mod_or_admin()) WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete event_participants" ON event_participants FOR DELETE TO authenticated USING (is_mod_or_admin());

-- ─── 7. One removal-integrity trigger instead of five ───────────────────────
--
-- `_raise_if_participant_has_awards` (20260417130000) is unchanged: it reads
-- public.event_participants, which is now this table. Deferred to commit, so
-- an event/player CASCADE delete — where the votes/resolutions rows vanish in
-- the same transaction — still passes, exactly like the old per-table
-- triggers. Kind/team moves are plain UPDATEs that keep the row, so only
-- DELETE and identity-column updates need guarding.

CREATE OR REPLACE FUNCTION _check_event_participant_removal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public._raise_if_participant_has_awards(OLD.event_id, OLD.player_id);
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._check_event_participant_removal() FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER check_event_participant_removal
  AFTER DELETE OR UPDATE OF event_id, player_id ON event_participants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _check_event_participant_removal();

-- ─── 8. Drop the replaced plumbing ──────────────────────────────────────────

DROP TABLE match_team_players;
DROP TABLE match_reserves;
DROP TABLE training_attendees;
DROP TABLE training_coaches;
DROP TABLE tournament_team_players;
DROP TABLE tournament_reserves;
DROP TABLE external_match_players;
DROP TABLE external_match_reserves;

ALTER TABLE matches DROP CONSTRAINT matches_winning_team_id_fkey;
DROP TABLE match_teams;
DROP TABLE matches;

ALTER TABLE tournaments DROP CONSTRAINT tournaments_winning_team_id_fkey;
DROP TABLE tournament_teams;
DROP TABLE tournaments;

DROP TABLE trainings;

-- Their constraint triggers died with the tables; the functions need explicit drops.
DROP FUNCTION _check_match_team_player_removal();
DROP FUNCTION _check_match_reserves_removal();
DROP FUNCTION _check_training_participant_removal();
DROP FUNCTION _check_tournament_team_player_removal();
DROP FUNCTION _check_tournament_reserves_removal();

-- Its only two triggers lived on matches and tournaments; with the winner now
-- behind set_event_winner, nothing references it.
DROP FUNCTION restrict_non_admin_to_winning_team_id_only();

-- ─── 9. Drop the backfill-mapping column ────────────────────────────────────

ALTER TABLE event_teams DROP COLUMN _src;
