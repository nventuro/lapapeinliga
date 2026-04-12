-- Location is optional: not every event has a confirmed venue at creation time.
ALTER TABLE events ALTER COLUMN location_id DROP NOT NULL;
