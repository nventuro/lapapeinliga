-- =============================================================================
-- Migration: Add tournament event type
--
-- Tournaments are a third event type alongside matches and trainings.
-- A tournament has fixed teams that play multiple head-to-head matches,
-- each with optional scores. Awards and winner live at the tournament level.
-- =============================================================================

-- ─── 1. Extend events.type to allow 'tournament' ──────────────────────────────

ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (type IN ('match', 'training', 'tournament'));

-- ─── 2. Create tournament tables ──────────────────────────────────────────────

CREATE TABLE tournaments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  -- winning_team_id FK added after tournament_teams exists
  winning_team_id bigint,
  mvp_id bigint REFERENCES players(id) ON DELETE SET NULL,
  top_scorer_id bigint REFERENCES players(id) ON DELETE SET NULL,
  best_defense_id bigint REFERENCES players(id) ON DELETE SET NULL,
  best_goalie_id bigint REFERENCES players(id) ON DELETE SET NULL,
  most_effort_id bigint REFERENCES players(id) ON DELETE SET NULL
);

CREATE TABLE tournament_teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id bigint NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) > 0)
);

-- Now add the circular FK for winning_team_id
ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_winning_team_id_fkey
  FOREIGN KEY (winning_team_id) REFERENCES tournament_teams(id) ON DELETE SET NULL;

CREATE TABLE tournament_team_players (
  tournament_team_id bigint NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_team_id, player_id)
);

CREATE TABLE tournament_reserves (
  tournament_id bigint NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (tournament_id, player_id)
);

CREATE TABLE tournament_matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id bigint NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id bigint NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  team_b_id bigint NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  score_a integer,
  score_b integer,
  CHECK ((score_a IS NULL) = (score_b IS NULL))
);

-- ─── 3. RLS policies ─────────────────────────────────────────────────────────

-- tournaments
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select tournaments" ON tournaments FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select tournaments" ON tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tournaments" ON tournaments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update tournaments" ON tournaments FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete tournaments" ON tournaments FOR DELETE TO authenticated USING (is_admin());

-- tournament_teams
ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select tournament_teams" ON tournament_teams FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select tournament_teams" ON tournament_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tournament_teams" ON tournament_teams FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update tournament_teams" ON tournament_teams FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete tournament_teams" ON tournament_teams FOR DELETE TO authenticated USING (is_admin());

-- tournament_team_players
ALTER TABLE tournament_team_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select tournament_team_players" ON tournament_team_players FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select tournament_team_players" ON tournament_team_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tournament_team_players" ON tournament_team_players FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete tournament_team_players" ON tournament_team_players FOR DELETE TO authenticated USING (is_admin());

-- tournament_reserves
ALTER TABLE tournament_reserves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select tournament_reserves" ON tournament_reserves FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select tournament_reserves" ON tournament_reserves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tournament_reserves" ON tournament_reserves FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete tournament_reserves" ON tournament_reserves FOR DELETE TO authenticated USING (is_admin());

-- tournament_matches
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select tournament_matches" ON tournament_matches FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select tournament_matches" ON tournament_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tournament_matches" ON tournament_matches FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update tournament_matches" ON tournament_matches FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete tournament_matches" ON tournament_matches FOR DELETE TO authenticated USING (is_admin());

-- ─── 4. Update event_participants view ────────────────────────────────────────

DROP VIEW event_participants;

CREATE VIEW event_participants WITH (security_invoker = true) AS
  -- Match team players
  SELECT e.id AS event_id, mtp.player_id
  FROM events e
  JOIN matches m ON m.event_id = e.id
  JOIN match_teams mt ON mt.match_id = m.id
  JOIN match_team_players mtp ON mtp.match_team_id = mt.id
  UNION
  -- Match reserves
  SELECT e.id AS event_id, mr.player_id
  FROM events e
  JOIN matches m ON m.event_id = e.id
  JOIN match_reserves mr ON mr.match_id = m.id
  UNION
  -- Training attendees
  SELECT e.id AS event_id, ta.player_id
  FROM events e
  JOIN trainings t ON t.event_id = e.id
  JOIN training_attendees ta ON ta.training_id = t.id
  UNION
  -- Training coaches
  SELECT e.id AS event_id, tc.player_id
  FROM events e
  JOIN trainings t ON t.event_id = e.id
  JOIN training_coaches tc ON tc.training_id = t.id
  UNION
  -- Tournament team players
  SELECT e.id AS event_id, ttp.player_id
  FROM events e
  JOIN tournaments tn ON tn.event_id = e.id
  JOIN tournament_teams tt ON tt.tournament_id = tn.id
  JOIN tournament_team_players ttp ON ttp.tournament_team_id = tt.id
  UNION
  -- Tournament reserves
  SELECT e.id AS event_id, tr.player_id
  FROM events e
  JOIN tournaments tn ON tn.event_id = e.id
  JOIN tournament_reserves tr ON tr.tournament_id = tn.id;

GRANT SELECT ON event_participants TO anon, authenticated;
