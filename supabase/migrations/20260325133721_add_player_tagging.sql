-- =============================================================================
-- Migration: Add player tagging for media gallery
--
-- Adds:
-- 1. event_participants view — unifies attendance across match and training
--    tables into a single queryable source (event_id, player_id).
-- 2. media_player_tags table — associates media items with tagged players.
-- =============================================================================

-- ─── 1. event_participants view ─────────────────────────────────────────────

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
  JOIN training_coaches tc ON tc.training_id = t.id;

GRANT SELECT ON event_participants TO anon, authenticated;

-- ─── 2. media_player_tags table ─────────────────────────────────────────────

CREATE TABLE media_player_tags (
  media_id bigint NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, player_id)
);

-- ─── 3. RLS policies ───────────────────────────────────────────────────────

ALTER TABLE media_player_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select media_player_tags"
  ON media_player_tags FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select media_player_tags"
  ON media_player_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert media_player_tags"
  ON media_player_tags FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete media_player_tags"
  ON media_player_tags FOR DELETE TO authenticated USING (is_admin());
