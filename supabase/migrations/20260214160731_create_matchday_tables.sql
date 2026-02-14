-- Matchdays: a day of play with optional winner and individual awards
create table matchdays (
  id bigint generated always as identity primary key,
  played_at date not null,
  winning_team_id bigint, -- FK added below after matchday_teams exists
  top_scorer_id bigint references players(id) on delete set null,
  best_defense_id bigint references players(id) on delete set null,
  mvp_id bigint references players(id) on delete set null
);

-- Teams within a matchday
create table matchday_teams (
  id bigint generated always as identity primary key,
  matchday_id bigint not null references matchdays(id) on delete cascade,
  name text not null check (length(name) > 0)
);

-- Now add the circular FK for winning_team_id
alter table matchdays
  add constraint matchdays_winning_team_id_fkey
  foreign key (winning_team_id) references matchday_teams(id) on delete set null;

-- Players assigned to a team in a matchday
create table matchday_team_players (
  matchday_team_id bigint not null references matchday_teams(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  primary key (matchday_team_id, player_id)
);

-- Reserve players for a matchday
create table matchday_reserves (
  matchday_id bigint not null references matchdays(id) on delete cascade,
  player_id bigint not null references players(id) on delete cascade,
  primary key (matchday_id, player_id)
);

-- RLS
alter table matchdays enable row level security;
alter table matchday_teams enable row level security;
alter table matchday_team_players enable row level security;
alter table matchday_reserves enable row level security;

-- Read: all authenticated users
create policy "Authenticated can select matchdays" on matchdays
  for select to authenticated using (true);

create policy "Authenticated can select matchday_teams" on matchday_teams
  for select to authenticated using (true);

create policy "Authenticated can select matchday_team_players" on matchday_team_players
  for select to authenticated using (true);

create policy "Authenticated can select matchday_reserves" on matchday_reserves
  for select to authenticated using (true);

-- Write: admin-only
create policy "Admins can insert matchdays" on matchdays
  for insert to authenticated with check (is_admin());

create policy "Admins can update matchdays" on matchdays
  for update to authenticated using (is_admin()) with check (is_admin());

create policy "Admins can delete matchdays" on matchdays
  for delete to authenticated using (is_admin());

create policy "Admins can insert matchday_teams" on matchday_teams
  for insert to authenticated with check (is_admin());

create policy "Admins can update matchday_teams" on matchday_teams
  for update to authenticated using (is_admin()) with check (is_admin());

create policy "Admins can delete matchday_teams" on matchday_teams
  for delete to authenticated using (is_admin());

create policy "Admins can insert matchday_team_players" on matchday_team_players
  for insert to authenticated with check (is_admin());

create policy "Admins can delete matchday_team_players" on matchday_team_players
  for delete to authenticated using (is_admin());

create policy "Admins can insert matchday_reserves" on matchday_reserves
  for insert to authenticated with check (is_admin());

create policy "Admins can delete matchday_reserves" on matchday_reserves
  for delete to authenticated using (is_admin());
