-- =============================================================================
-- Store R2 object KEYS in media paths, not full public URLs.
--
-- media.storage_path / thumbnail_path held full public URLs
-- (https://pub-….r2.dev/full/<uuid>.jpg). Two problems:
--   * a moderator (media INSERT is mod-level, 20260425120000) could point a row
--     at ANY host — the gallery would happily render attacker-controlled
--     content from an arbitrary origin;
--   * every stored row was coupled to the current r2.dev public domain, so a
--     domain change meant rewriting the whole table.
--
-- The client now stores bare object keys ('full/<uuid>.jpg', 'thumb/<uuid>.jpg',
-- 'video/<uuid>.webm') and prefixes the public base URL at render time.
--
-- 1. Backfill: strip the scheme+host from existing rows. Idempotent — rows
--    already in key form have no scheme, so the regexp doesn't match and
--    leaves them untouched.
-- 2. CHECK constraints pin both columns to the exact shapes the media-upload
--    edge function will presign (same tight 8-4-4-4-12 hex UUID, and the
--    extension bound to its prefix: full/*.jpg | video/*.webm, thumb/*.jpg) —
--    so a row can never point outside the bucket's known key space again.
-- 3. UNIQUE on storage_path: two rows can never claim the same object, and
--    idempotent client retries of the same upload conflict cleanly instead of
--    duplicating.
-- =============================================================================


-- ─── 1. Backfill: URL → key ─────────────────────────────────────────────────

UPDATE media SET
  storage_path   = regexp_replace(storage_path,   '^https?://[^/]+/', ''),
  thumbnail_path = regexp_replace(thumbnail_path, '^https?://[^/]+/', '');


-- ─── 2. Pin both columns to the known key shapes ────────────────────────────

-- Matches the edge function's allowlist exactly: full/<uuid>.jpg or
-- video/<uuid>.webm (extension bound to its prefix, tight UUID).
ALTER TABLE media
  ADD CONSTRAINT media_storage_path_format_check CHECK (
    storage_path ~ '^(full/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg|video/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webm)$'
  );

-- Thumbnails are always JPEGs (videos get a jpg poster frame too).
ALTER TABLE media
  ADD CONSTRAINT media_thumbnail_path_format_check CHECK (
    thumbnail_path ~ '^thumb/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  );


-- ─── 3. One row per object ──────────────────────────────────────────────────

ALTER TABLE media
  ADD CONSTRAINT media_storage_path_key UNIQUE (storage_path);
