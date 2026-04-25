-- =============================================================================
-- Migration: Allow mods to upload + tag media
--
-- Loosens the write policies needed for the upload+tag flow on media,
-- media_tags, media_tag_assignments, and media_player_tags. Hard curation
-- (renaming a tag, editing a caption, deleting a media row) stays admin-only.
--
-- The media-upload Edge Function gates POST (presigned uploads) on
-- is_mod_or_admin() and DELETE (R2 object removal) on is_admin(), keeping the
-- two layers in lock-step.
-- =============================================================================

-- ─── media ──────────────────────────────────────────────────────────────────
-- INSERT (creating a media row during upload) opens to mods.
-- UPDATE/DELETE stay admin-only.

DROP POLICY "Admins can insert media" ON media;
CREATE POLICY "Mods can insert media" ON media
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());

-- ─── media_tags ─────────────────────────────────────────────────────────────
-- INSERT opens to mods (upload flow creates new tags on the fly).
-- UPDATE/DELETE (renaming/removing tags from the catalog) stay admin-only.

DROP POLICY "Admins can insert media_tags" ON media_tags;
CREATE POLICY "Mods can insert media_tags" ON media_tags
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());

-- ─── media_tag_assignments ──────────────────────────────────────────────────
-- INSERT and DELETE both open to mods — assignments are reversible by design
-- (the upload dialog and any future re-tagging UI need both).

DROP POLICY "Admins can insert media_tag_assignments" ON media_tag_assignments;
DROP POLICY "Admins can delete media_tag_assignments" ON media_tag_assignments;
CREATE POLICY "Mods can insert media_tag_assignments" ON media_tag_assignments
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete media_tag_assignments" ON media_tag_assignments
  FOR DELETE TO authenticated USING (is_mod_or_admin());

-- ─── media_player_tags ──────────────────────────────────────────────────────
-- Same shape: lightbox player tagging is a toggle (insert + delete).

DROP POLICY "Admins can insert media_player_tags" ON media_player_tags;
DROP POLICY "Admins can delete media_player_tags" ON media_player_tags;
CREATE POLICY "Mods can insert media_player_tags" ON media_player_tags
  FOR INSERT TO authenticated WITH CHECK (is_mod_or_admin());
CREATE POLICY "Mods can delete media_player_tags" ON media_player_tags
  FOR DELETE TO authenticated USING (is_mod_or_admin());
