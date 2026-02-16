-- Locations (canchas) — reusable across matchdays
create table locations (
  id bigint generated always as identity primary key,
  name text not null check (length(name) > 0),
  maps_url text not null check (length(maps_url) > 0)
);

-- Add time and location to matchdays
alter table matchdays
  add column played_at_time time,
  add column location_id bigint references locations(id) on delete set null;

-- RLS for locations (same pattern as matchdays)
alter table locations enable row level security;

create policy "Authenticated can select locations" on locations
  for select to authenticated using (true);

create policy "Admins can insert locations" on locations
  for insert to authenticated with check (is_admin());

create policy "Admins can update locations" on locations
  for update to authenticated using (is_admin()) with check (is_admin());

create policy "Admins can delete locations" on locations
  for delete to authenticated using (is_admin());
