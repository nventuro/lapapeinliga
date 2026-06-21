-- =============================================================================
-- Migration: Add external-team match event type
--
-- An "external match" is a fourth event type alongside matches, trainings and
-- tournaments. It pits one papeinliga team (a roster of our players, plus
-- reserves) against an external opponent that is just a name -- no player list.
--
-- We track the final score (our_score vs their_score, hence win/loss/draw),
-- and individual goals for OUR players only (the opponent's score is a single
-- number). Opponents live in a reference table so head-to-head records survive
-- across events. There is no award voting or feedback for these events: the
-- existing vote/feedback write RPCs already restrict to ('match','tournament'),
-- so external matches are excluded fail-closed without further changes.
-- =============================================================================

-- ─── 1. Extend events.type to allow 'external_match' ──────────────────────────

ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('match', 'training', 'tournament', 'external_match'));

-- ─── 2. External opponents reference table ────────────────────────────────────

CREATE TABLE external_teams (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (length(name) > 0)
);

-- Case-insensitive uniqueness so "Los Pibes" and "los pibes" don't fork the
-- head-to-head record.
CREATE UNIQUE INDEX external_teams_name_lower_idx ON external_teams (lower(name));

-- ─── 3. External match details ────────────────────────────────────────────────
--
-- Scores are nullable until the match is played/recorded; both are set or both
-- are null together (mirrors tournament_matches). The winner is derived in the
-- app from the two scores (win/loss/draw), so there is no winning_team_id.

CREATE TABLE external_matches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  external_team_id bigint NOT NULL REFERENCES external_teams(id) ON DELETE RESTRICT,
  our_score integer CHECK (our_score IS NULL OR our_score >= 0),
  their_score integer CHECK (their_score IS NULL OR their_score >= 0),
  CHECK ((our_score IS NULL) = (their_score IS NULL))
);

-- ─── 4. Our roster (with individual goals) and reserves ───────────────────────
--
-- Goals are tracked for our players only. The sum of attributed goals may be
-- less than our_score (own goals by the opponent, or goals nobody attributed);
-- it is never validated to equal our_score.

CREATE TABLE external_match_players (
  external_match_id bigint NOT NULL REFERENCES external_matches(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  goals integer NOT NULL DEFAULT 0 CHECK (goals >= 0),
  PRIMARY KEY (external_match_id, player_id)
);

CREATE TABLE external_match_reserves (
  external_match_id bigint NOT NULL REFERENCES external_matches(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (external_match_id, player_id)
);

-- ─── 5. RLS policies ─────────────────────────────────────────────────────────

-- external_teams: everyone reads (names shown on list/detail), admins manage.
ALTER TABLE external_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select external_teams" ON external_teams FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select external_teams" ON external_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert external_teams" ON external_teams FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update external_teams" ON external_teams FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete external_teams" ON external_teams FOR DELETE TO authenticated USING (is_admin());

-- external_matches: everyone reads, admins manage (scores included).
ALTER TABLE external_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select external_matches" ON external_matches FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select external_matches" ON external_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert external_matches" ON external_matches FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update external_matches" ON external_matches FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete external_matches" ON external_matches FOR DELETE TO authenticated USING (is_admin());

-- external_match_players: everyone reads. Mods can add/remove (participant
-- moves) like other join tables; goals updates are admin-only.
ALTER TABLE external_match_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select external_match_players" ON external_match_players FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select external_match_players" ON external_match_players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mods can insert external_match_players" ON external_match_players FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Admins can update external_match_players" ON external_match_players FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Mods can delete external_match_players" ON external_match_players FOR DELETE TO authenticated USING (is_mod_or_admin());

-- external_match_reserves: everyone reads, mods add/remove.
ALTER TABLE external_match_reserves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select external_match_reserves" ON external_match_reserves FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select external_match_reserves" ON external_match_reserves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Mods can insert external_match_reserves" ON external_match_reserves FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete external_match_reserves" ON external_match_reserves FOR DELETE TO authenticated USING (is_mod_or_admin());

-- ─── 6. Update event_participants view ────────────────────────────────────────
--
-- Adds external-match rosters and reserves so cost-per-player splitting and any
-- participant-based feature counts them.

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
  JOIN tournament_reserves tr ON tr.tournament_id = tn.id
  UNION
  -- External match roster
  SELECT e.id AS event_id, emp.player_id
  FROM events e
  JOIN external_matches em ON em.event_id = e.id
  JOIN external_match_players emp ON emp.external_match_id = em.id
  UNION
  -- External match reserves
  SELECT e.id AS event_id, emr.player_id
  FROM events e
  JOIN external_matches em ON em.event_id = e.id
  JOIN external_match_reserves emr ON emr.external_match_id = em.id;

GRANT SELECT ON event_participants TO anon, authenticated;
