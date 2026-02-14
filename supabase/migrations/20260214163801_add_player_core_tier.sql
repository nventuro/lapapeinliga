-- Add core/non-core player tier
alter table players add column is_core boolean not null default true;

-- Make rating nullable (non-core players may have no rating)
alter table players alter column rating drop not null;

-- Core players must have a rating
alter table players add constraint core_players_must_have_rating
  check (is_core = false or rating is not null);

-- Recreate public view to include is_core (no sensitive data)
drop view players_public;
create view players_public as
  select id, name, gender, is_core from players;

grant select on players_public to anon, authenticated;
