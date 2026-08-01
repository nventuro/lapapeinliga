-- =============================================================================
-- FK indexes + referential-integrity tightening (cheap wins).
--
-- 1. Postgres does not auto-index the referencing side of a foreign key, so
--    every FK-driven join/filter and every ON DELETE CASCADE/SET NULL was a
--    sequential scan. Index each un-indexed FK column. Junction-table PKs like
--    (a_id, b_id) already index their LEADING column, so only the second
--    column gets a new index there.
--
-- 2. matches.winning_team_id / tournaments.winning_team_id / the two
--    tournament_matches team columns referenced their teams table by bare id,
--    so nothing stopped a winner (or a fixture side) from pointing at a team
--    of a DIFFERENT match/tournament. Replace them with composite FKs through
--    a UNIQUE (parent_id, id) key so "the team belongs to this event" is
--    enforced by the database. Uses ON DELETE SET NULL (column) — PG 15+.
--
-- 3. A few missing CHECKs on plausible-garbage values, and
--    event_award_resolutions.player_id moves from CASCADE to RESTRICT so
--    deleting a player cannot silently erase award history (the award-integrity
--    triggers from 20260417130000 protect it everywhere else).
-- =============================================================================


-- ─── 1. Indexes on un-indexed FK columns ────────────────────────────────────

-- Junction tables: PK (parent_id, player_id) already covers parent_id.
CREATE INDEX match_team_players_player_id_idx ON match_team_players (player_id);
CREATE INDEX match_reserves_player_id_idx ON match_reserves (player_id);
CREATE INDEX training_attendees_player_id_idx ON training_attendees (player_id);
CREATE INDEX training_coaches_player_id_idx ON training_coaches (player_id);
CREATE INDEX tournament_team_players_player_id_idx ON tournament_team_players (player_id);
CREATE INDEX tournament_reserves_player_id_idx ON tournament_reserves (player_id);
CREATE INDEX external_match_players_player_id_idx ON external_match_players (player_id);
CREATE INDEX external_match_reserves_player_id_idx ON external_match_reserves (player_id);
CREATE INDEX media_tag_assignments_tag_id_idx ON media_tag_assignments (tag_id);
CREATE INDEX media_player_tags_player_id_idx ON media_player_tags (player_id);
CREATE INDEX player_preferences_player_b_id_idx ON player_preferences (player_b_id);

-- event_award_votes PK is (event_id, award_type, voter_player_id): only
-- event_id is a usable prefix, so both player FKs need indexes.
CREATE INDEX event_award_votes_candidate_player_id_idx ON event_award_votes (candidate_player_id);
CREATE INDEX event_award_votes_voter_player_id_idx ON event_award_votes (voter_player_id);

-- event_award_resolutions PK (event_id, award_type) covers event_id.
CREATE INDEX event_award_resolutions_player_id_idx ON event_award_resolutions (player_id);

-- event_feedback PK (event_id, voter_player_id) covers event_id.
CREATE INDEX event_feedback_voter_player_id_idx ON event_feedback (voter_player_id);

-- Plain FK columns on regular tables.
CREATE INDEX events_location_id_idx ON events (location_id);
CREATE INDEX media_event_id_idx ON media (event_id);
CREATE INDEX external_matches_external_team_id_idx ON external_matches (external_team_id);

-- tournament_matches: these two composite indexes serve the new composite FKs
-- of section 2 AND cover tournament_id as their leading column, so no separate
-- tournament_id index is needed.
CREATE INDEX tournament_matches_tournament_id_team_a_id_idx ON tournament_matches (tournament_id, team_a_id);
CREATE INDEX tournament_matches_tournament_id_team_b_id_idx ON tournament_matches (tournament_id, team_b_id);

-- match_teams.match_id and tournament_teams.tournament_id are NOT indexed
-- here: the UNIQUE (parent_id, id) keys added in section 2 index them as the
-- leading column.


-- ─── 2. Winner/fixture teams must belong to their own match/tournament ──────

-- matches.winning_team_id → a team of THIS match.
-- Composite key on the referenced side: (match_id, id) identifies a team
-- within its match.
ALTER TABLE match_teams
  ADD CONSTRAINT match_teams_match_id_id_key UNIQUE (match_id, id);

ALTER TABLE matches
  DROP CONSTRAINT matches_winning_team_id_fkey;
-- Column order: matches.id pairs with match_teams.match_id, and
-- matches.winning_team_id pairs with match_teams.id — i.e. "the winning team's
-- match is this match". MATCH SIMPLE (the default) skips the check while
-- winning_team_id is NULL. ON DELETE SET NULL (winning_team_id) nulls only the
-- winner column (never matches.id) when the team row goes away, preserving the
-- old single-column FK's SET NULL behavior.
ALTER TABLE matches
  ADD CONSTRAINT matches_winning_team_id_fkey
  FOREIGN KEY (id, winning_team_id) REFERENCES match_teams (match_id, id)
  ON DELETE SET NULL (winning_team_id);

-- tournaments.winning_team_id → a team of THIS tournament (same pattern).
ALTER TABLE tournament_teams
  ADD CONSTRAINT tournament_teams_tournament_id_id_key UNIQUE (tournament_id, id);

ALTER TABLE tournaments
  DROP CONSTRAINT tournaments_winning_team_id_fkey;
ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_winning_team_id_fkey
  FOREIGN KEY (id, winning_team_id) REFERENCES tournament_teams (tournament_id, id)
  ON DELETE SET NULL (winning_team_id);

-- tournament_matches: both fixture sides must be teams of THIS tournament.
-- The single-column tournament_id → tournaments FK is kept (it provides the
-- cascade when a tournament is deleted); only the two team FKs are replaced.
-- Both columns are NOT NULL so the composite FKs are always enforced, and
-- ON DELETE CASCADE keeps the old behavior: deleting a team deletes its
-- fixtures.
ALTER TABLE tournament_matches
  DROP CONSTRAINT tournament_matches_team_a_id_fkey,
  DROP CONSTRAINT tournament_matches_team_b_id_fkey;
ALTER TABLE tournament_matches
  ADD CONSTRAINT tournament_matches_team_a_id_fkey
    FOREIGN KEY (tournament_id, team_a_id) REFERENCES tournament_teams (tournament_id, id) ON DELETE CASCADE,
  ADD CONSTRAINT tournament_matches_team_b_id_fkey
    FOREIGN KEY (tournament_id, team_b_id) REFERENCES tournament_teams (tournament_id, id) ON DELETE CASCADE;

-- A team can't play itself.
ALTER TABLE tournament_matches
  ADD CONSTRAINT tournament_matches_teams_differ_check CHECK (team_a_id <> team_b_id);


-- ─── 3. Value sanity CHECKs ─────────────────────────────────────────────────

-- NULL cost (unknown/free) is allowed; a negative one never is.
ALTER TABLE event_finances
  ADD CONSTRAINT event_finances_cost_check CHECK (cost >= 0);

-- aspect_ratio is width/height; zero or negative would break gallery layout.
ALTER TABLE media
  ADD CONSTRAINT media_aspect_ratio_check CHECK (aspect_ratio > 0);

-- Cap player names at 80 chars (MAX_PLAYER_NAME_LENGTH in src/types.ts; the
-- cap is enforced by update_my_player_name too — see 20260802100002).
ALTER TABLE players
  ADD CONSTRAINT players_name_length_check CHECK (char_length(name) <= 80);


-- ─── 4. Award history survives player deletion ──────────────────────────────

-- Deleting a player must not silently erase award history: the removal
-- triggers (20260417130000) protect awarded players on every participant
-- table, so the resolutions table itself must not be the one hole through
-- which a resolved award silently vanishes. RESTRICT forces the admin to
-- consciously deal with the award first.
ALTER TABLE event_award_resolutions
  DROP CONSTRAINT event_award_resolutions_player_id_fkey,
  ADD CONSTRAINT event_award_resolutions_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE RESTRICT;
