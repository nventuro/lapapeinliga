-- Convert binary is_core flag to three-tier system (core / sporadic / guest)

-- Add tier column
alter table players add column tier text not null default 'guest';

-- Backfill from is_core
update players set tier = 'core' where is_core = true;
update players set tier = 'guest' where is_core = false;

-- Add constraint for valid tier values
alter table players add constraint valid_tier
  check (tier in ('core', 'sporadic', 'guest'));

-- Replace core rating constraint with non-guest constraint
alter table players drop constraint core_players_must_have_rating;
alter table players add constraint non_guest_players_must_have_rating
  check (tier = 'guest' or rating is not null);

-- Drop view that depends on is_core, then drop the column
drop view players_public;
alter table players drop column is_core;

-- Recreate public view with tier
create view players_public as
  select id, name, gender, tier from players;

grant select on players_public to anon, authenticated;
