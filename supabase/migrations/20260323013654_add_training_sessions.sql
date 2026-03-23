-- =============================================================================
-- Migration: Restructure matchday tables into events + matches/trainings
--
-- Creates a shared parent `events` table with child `matches` and `trainings`
-- tables. Renames matchday_* tables to match_*. Adds training_attendees and
-- training_coaches tables. Migrates existing data preserving IDs.
-- =============================================================================

-- ─── 1. Create new tables ────────────────────────────────────────────────────

CREATE TABLE events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  short_id text NOT NULL DEFAULT substr(encode(gen_random_bytes(4), 'hex'), 1, 7) UNIQUE,
  name text,
  type text NOT NULL CHECK (type IN ('match', 'training')),
  played_at date NOT NULL,
  played_at_time time,
  location_id bigint REFERENCES locations(id) ON DELETE SET NULL,
  cost integer,
  payee_alias_cbu text
);

CREATE TABLE matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  -- winning_team_id FK added after match_teams is populated
  winning_team_id bigint,
  top_scorer_id bigint REFERENCES players(id) ON DELETE SET NULL,
  best_defense_id bigint REFERENCES players(id) ON DELETE SET NULL,
  mvp_id bigint REFERENCES players(id) ON DELETE SET NULL,
  best_goalie_id bigint REFERENCES players(id) ON DELETE SET NULL,
  most_effort_id bigint REFERENCES players(id) ON DELETE SET NULL
);

CREATE TABLE match_teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id bigint NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) > 0),
  shirt_color text NOT NULL DEFAULT 'light' CHECK (shirt_color IN ('light', 'dark'))
);

CREATE TABLE match_team_players (
  match_team_id bigint NOT NULL REFERENCES match_teams(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (match_team_id, player_id)
);

CREATE TABLE match_reserves (
  match_id bigint NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE trainings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE training_attendees (
  training_id bigint NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (training_id, player_id)
);

CREATE TABLE training_coaches (
  training_id bigint NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (training_id, player_id)
);

-- ─── 2. Migrate data (preserving IDs) ───────────────────────────────────────

INSERT INTO events (id, short_id, name, type, played_at, played_at_time, location_id, cost, payee_alias_cbu)
  OVERRIDING SYSTEM VALUE
  SELECT id, short_id, name, 'match', played_at, played_at_time, location_id, cost, payee_alias_cbu
  FROM matchdays;

SELECT setval(pg_get_serial_sequence('events', 'id'), COALESCE((SELECT MAX(id) FROM events), 0));

INSERT INTO matches (id, event_id, winning_team_id, top_scorer_id, best_defense_id, mvp_id, best_goalie_id, most_effort_id)
  OVERRIDING SYSTEM VALUE
  SELECT id, id, winning_team_id, top_scorer_id, best_defense_id, mvp_id, best_goalie_id, most_effort_id
  FROM matchdays;

SELECT setval(pg_get_serial_sequence('matches', 'id'), COALESCE((SELECT MAX(id) FROM matches), 0));

INSERT INTO match_teams (id, match_id, name, shirt_color)
  OVERRIDING SYSTEM VALUE
  SELECT id, matchday_id, name, shirt_color
  FROM matchday_teams;

SELECT setval(pg_get_serial_sequence('match_teams', 'id'), COALESCE((SELECT MAX(id) FROM match_teams), 0));

INSERT INTO match_team_players (match_team_id, player_id)
  SELECT matchday_team_id, player_id FROM matchday_team_players;

INSERT INTO match_reserves (match_id, player_id)
  SELECT matchday_id, player_id FROM matchday_reserves;

-- ─── 3. Add winning_team_id FK (now that match_teams is populated) ──────────

ALTER TABLE matches
  ADD CONSTRAINT matches_winning_team_id_fkey
  FOREIGN KEY (winning_team_id) REFERENCES match_teams(id) ON DELETE SET NULL;

-- ─── 4. Drop old tables ─────────────────────────────────────────────────────

DROP TABLE matchday_team_players;
DROP TABLE matchday_reserves;
ALTER TABLE matchdays DROP CONSTRAINT IF EXISTS matchdays_winning_team_id_fkey;
DROP TABLE matchday_teams;
DROP TABLE matchdays;

-- ─── 5. RLS policies ────────────────────────────────────────────────────────

-- events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select events" ON events FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select events" ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert events" ON events FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update events" ON events FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete events" ON events FOR DELETE TO authenticated USING (is_admin());

-- matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select matches" ON matches FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select matches" ON matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert matches" ON matches FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update matches" ON matches FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete matches" ON matches FOR DELETE TO authenticated USING (is_admin());

-- match_teams
ALTER TABLE match_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select match_teams" ON match_teams FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select match_teams" ON match_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert match_teams" ON match_teams FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update match_teams" ON match_teams FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete match_teams" ON match_teams FOR DELETE TO authenticated USING (is_admin());

-- match_team_players
ALTER TABLE match_team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select match_team_players" ON match_team_players FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select match_team_players" ON match_team_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert match_team_players" ON match_team_players FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete match_team_players" ON match_team_players FOR DELETE TO authenticated USING (is_admin());

-- match_reserves
ALTER TABLE match_reserves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select match_reserves" ON match_reserves FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select match_reserves" ON match_reserves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert match_reserves" ON match_reserves FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete match_reserves" ON match_reserves FOR DELETE TO authenticated USING (is_admin());

-- trainings
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select trainings" ON trainings FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select trainings" ON trainings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert trainings" ON trainings FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update trainings" ON trainings FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete trainings" ON trainings FOR DELETE TO authenticated USING (is_admin());

-- training_attendees
ALTER TABLE training_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select training_attendees" ON training_attendees FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select training_attendees" ON training_attendees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert training_attendees" ON training_attendees FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete training_attendees" ON training_attendees FOR DELETE TO authenticated USING (is_admin());

-- training_coaches
ALTER TABLE training_coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select training_coaches" ON training_coaches FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select training_coaches" ON training_coaches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert training_coaches" ON training_coaches FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete training_coaches" ON training_coaches FOR DELETE TO authenticated USING (is_admin());
