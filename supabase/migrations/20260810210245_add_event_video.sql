-- =============================================================================
-- Optional match video per event.
--
-- events.video_key holds the R2 object key of a match recording
-- (matches/<slug>.mp4). Videos are produced and uploaded outside the app;
-- the app only renders the player. The key is written straight to the row by
-- whoever runs the upload, so no grant or policy changes are needed.
--
-- Same reasoning as media.storage_path: the client turns this column into a
-- URL it hands to a <video> element, so its shape is pinned — a row can never
-- point the player at an arbitrary origin or outside the matches/ prefix.
-- =============================================================================

ALTER TABLE events
  ADD COLUMN video_key text
  CONSTRAINT events_video_key_format_check CHECK (
    video_key ~ '^matches/[a-z0-9-]+\.mp4$'
  );
