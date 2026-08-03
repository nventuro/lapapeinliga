-- =============================================================================
-- The story behind a trophy.
--
-- A title and a date say what was won and when; they do not say how. The detail
-- page has room for a paragraph, so trophies get one.
--
-- Separate from 20260802120000 rather than folded into it, because that
-- migration has already run against production. Supabase records a migration as
-- applied by its version (the filename timestamp), so editing an applied file
-- does not re-run it -- the change would be silently skipped and the column
-- would exist nowhere but in the repo.
--
-- NULL, never '': "no description" gets exactly one representation, so no
-- caller has to test for both. The client sends `description.trim() || null`
-- and this CHECK is what keeps that honest.
-- =============================================================================

ALTER TABLE trophies
  ADD COLUMN description text CHECK (
    description IS NULL OR (length(trim(description)) > 0 AND length(description) <= 1000)
  );
