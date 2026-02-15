-- Add best goalie and most effort award columns
alter table matchdays
  add column best_goalie_id bigint references players(id) on delete set null,
  add column most_effort_id bigint references players(id) on delete set null;
