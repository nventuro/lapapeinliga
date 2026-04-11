-- Make played_at_time and location_id required on events. All existing rows
-- already have both values, and the forthcoming award-voting feature depends
-- on played_at_time being present to compute the voting window.

ALTER TABLE events ALTER COLUMN played_at_time SET NOT NULL;
ALTER TABLE events ALTER COLUMN location_id SET NOT NULL;
