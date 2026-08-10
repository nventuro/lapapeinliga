-- =============================================================================
-- Drop video support from the media gallery.
--
-- The gallery is picture-only: the app no longer uploads or renders videos,
-- and the media-upload edge function no longer presigns video keys.
--
-- 1. Refuse to run if any video row exists. None do today, but this migration
--    deletes the only record of a row being a video — if one appeared before
--    the push, dropping the column would silently turn it into a broken
--    "photo" pointing at a .webm object.
-- 2. media_type only ever distinguished images from videos; with a single
--    media type left it says nothing, so drop it (its CHECK goes with it).
-- 3. Re-pin storage_path to the one key shape that remains (full/<uuid>.jpg).
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM media WHERE media_type = 'video') THEN
    RAISE EXCEPTION 'media table contains video rows; refusing to drop video support';
  END IF;
END $$;

ALTER TABLE media DROP COLUMN media_type;

ALTER TABLE media DROP CONSTRAINT media_storage_path_format_check;
ALTER TABLE media
  ADD CONSTRAINT media_storage_path_format_check CHECK (
    storage_path ~ '^full/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );
