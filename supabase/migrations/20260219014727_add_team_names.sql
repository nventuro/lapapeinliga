-- Pool of fun team names, randomly assigned during team generation
create table team_names (
  id bigint generated always as identity primary key,
  name text unique not null check (length(name) > 0)
);

alter table team_names enable row level security;

-- Public read access (anon + authenticated)
create policy "Anon can select team_names" on team_names
  for select to anon using (true);

create policy "Authenticated can select team_names" on team_names
  for select to authenticated using (true);

-- Admin-only write access
create policy "Admins can insert team_names" on team_names
  for insert to authenticated with check (is_admin());

create policy "Admins can update team_names" on team_names
  for update to authenticated using (is_admin()) with check (is_admin());

create policy "Admins can delete team_names" on team_names
  for delete to authenticated using (is_admin());
