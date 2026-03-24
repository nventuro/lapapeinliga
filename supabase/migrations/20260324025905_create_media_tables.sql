-- =============================================================================
-- Migration: Create media gallery tables
--
-- Adds media, media_tags, and media_tag_assignments tables for the photo/video
-- gallery feature. Media items can optionally be linked to events.
-- =============================================================================

-- ─── 1. Create tables ─────────────────────────────────────────────────────────

CREATE TABLE media (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  thumbnail_path text NOT NULL,
  caption text,
  taken_at date NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video'))
);

CREATE TABLE media_tags (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(name) > 0)
);

CREATE TABLE media_tag_assignments (
  media_id bigint NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES media_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, tag_id)
);

-- ─── 2. RLS policies ─────────────────────────────────────────────────────────

-- media
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select media" ON media FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select media" ON media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert media" ON media FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update media" ON media FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete media" ON media FOR DELETE TO authenticated USING (is_admin());

-- media_tags
ALTER TABLE media_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select media_tags" ON media_tags FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select media_tags" ON media_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert media_tags" ON media_tags FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update media_tags" ON media_tags FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins can delete media_tags" ON media_tags FOR DELETE TO authenticated USING (is_admin());

-- media_tag_assignments
ALTER TABLE media_tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select media_tag_assignments" ON media_tag_assignments FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select media_tag_assignments" ON media_tag_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert media_tag_assignments" ON media_tag_assignments FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete media_tag_assignments" ON media_tag_assignments FOR DELETE TO authenticated USING (is_admin());
