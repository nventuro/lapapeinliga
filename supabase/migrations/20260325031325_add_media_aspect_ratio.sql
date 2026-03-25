-- =============================================================================
-- Migration: Add aspect_ratio to media, delete existing rows
--
-- Adds a NOT NULL aspect_ratio column (width / height) to the media table.
-- All existing media rows are deleted first since they lack this data and
-- the corresponding R2 objects will be cleaned up manually.
-- =============================================================================

-- Delete all existing media (and cascading tag assignments)
DELETE FROM media;

-- Add aspect_ratio column (width / height, e.g. 0.75 for portrait, 1.33 for landscape)
ALTER TABLE media ADD COLUMN aspect_ratio real NOT NULL;
