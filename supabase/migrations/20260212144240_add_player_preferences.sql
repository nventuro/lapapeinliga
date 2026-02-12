create table player_preferences (
  player_a_id bigint not null references players(id) on delete cascade,
  player_b_id bigint not null references players(id) on delete cascade,
  preference text not null check (preference in (
    'prefer_with', 'strongly_prefer_with', 'prefer_not_with'
  )),
  -- Primary key ensures each pair has at most one preference
  primary key (player_a_id, player_b_id),
  check (player_a_id < player_b_id)
);

alter table player_preferences enable row level security;

-- Reuse same admin-only access pattern as players table
create policy "Admins can select player_preferences" on player_preferences
  for select to authenticated using (is_admin());

create policy "Admins can insert player_preferences" on player_preferences
  for insert to authenticated with check (is_admin());

create policy "Admins can update player_preferences" on player_preferences
  for update to authenticated
  using (is_admin()) with check (is_admin());

create policy "Admins can delete player_preferences" on player_preferences
  for delete to authenticated using (is_admin());
