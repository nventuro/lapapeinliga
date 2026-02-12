create table players (
  id bigint generated always as identity primary key,
  name text not null check (length(name) > 0),
  gender text not null check (gender in ('male', 'female')),
  rating smallint not null check (rating between 1 and 10)
);

alter table players enable row level security;

-- Admin helper
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    auth.jwt() ->> 'email' in (
      'nicolas.venturo@gmail.com',
      'gustavobarbaresi@gmail.com'
    ), false
  )
$$;

-- Only admins can access the table directly (read + write)
create policy "Admins can select players" on players
  for select to authenticated using (is_admin());

create policy "Admins can insert players" on players
  for insert to authenticated with check (is_admin());

create policy "Admins can update players" on players
  for update to authenticated
  using (is_admin()) with check (is_admin());

create policy "Admins can delete players" on players
  for delete to authenticated using (is_admin());

-- Public view (no rating column)
create view players_public as
  select id, name, gender from players;

grant select on players_public to anon, authenticated;
