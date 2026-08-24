-- Teams can wear red or blue as well as light or dark. The column stays
-- nullable: a team with no recorded shirt is still a valid team.
ALTER TABLE event_teams DROP CONSTRAINT event_teams_shirt_color_check;
ALTER TABLE event_teams
  ADD CONSTRAINT event_teams_shirt_color_check
  CHECK (shirt_color IN ('light', 'dark', 'red', 'blue'));
