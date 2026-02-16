-- Add a short random hex identifier for URLs (like GitHub commit SHAs)
alter table matchdays
  add column short_id text default substr(encode(gen_random_bytes(4), 'hex'), 1, 7);

-- Populate existing rows
update matchdays set short_id = substr(encode(gen_random_bytes(4), 'hex'), 1, 7);

-- Now enforce constraints
alter table matchdays alter column short_id set not null;
alter table matchdays add constraint matchdays_short_id_unique unique (short_id);
