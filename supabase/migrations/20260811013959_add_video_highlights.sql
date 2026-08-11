-- =============================================================================
-- Admin-curated highlights for event match videos.
--
-- A highlight is a labelled instant in an event's video ("Gol de Flor" at
-- 12:30); the event page lists them and tapping one seeks the player there.
-- Only admins curate them, so writes are admin-gated while reads stay public
-- like the rest of the event data. The label cap matches
-- MAX_VIDEO_HIGHLIGHT_LABEL_LENGTH in the client.
--
-- (event_id, seconds) is unique: two highlights can't sit on the same frame,
-- and an accidental double-submit conflicts instead of duplicating.
-- =============================================================================

CREATE TABLE event_video_highlights (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seconds integer NOT NULL CHECK (seconds >= 0),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, seconds)
);

ALTER TABLE event_video_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select event_video_highlights" ON event_video_highlights FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select event_video_highlights" ON event_video_highlights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert event_video_highlights" ON event_video_highlights FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update event_video_highlights" ON event_video_highlights FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete event_video_highlights" ON event_video_highlights FOR DELETE TO authenticated USING (is_admin());
