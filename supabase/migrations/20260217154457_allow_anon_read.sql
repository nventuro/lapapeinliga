-- Allow anonymous (unauthenticated) users to read public data.
-- Write policies remain admin-only via is_admin().

create policy "Anon can select matchdays" on matchdays
  for select to anon using (true);

create policy "Anon can select matchday_teams" on matchday_teams
  for select to anon using (true);

create policy "Anon can select matchday_team_players" on matchday_team_players
  for select to anon using (true);

create policy "Anon can select matchday_reserves" on matchday_reserves
  for select to anon using (true);

create policy "Anon can select locations" on locations
  for select to anon using (true);
