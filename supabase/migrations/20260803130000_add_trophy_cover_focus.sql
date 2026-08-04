-- =============================================================================
-- Where a trophy cover should be centered.
--
-- The same cover renders at three aspect ratios (the 4:5 lead card, the 16:10
-- list cards, the 3:2 detail hero), so `object-fit: cover` always crops it --
-- and its default centering has been cropping faces out of celebration photos.
-- A stored crop cannot fix that for three frames at once; a focal point can,
-- which is what these columns are: the point of the image (in percent of each
-- axis) that every frame keeps in view, fed to CSS `object-position`. 50/50 is
-- exactly the centering the app has today, so existing covers do not move.
--
-- The trigger resets the focus whenever the cover changes -- a focal point is
-- a fact about one photo, and it going stale on the next is not a client
-- courtesy but an invariant, because covers also change without any client
-- involved (deleting the cover photo promotes another, see 20260802120000).
-- BEFORE UPDATE OF cover_media_id: a focus-only update never lists the column
-- in its SET, so adjusting the framing does not re-trigger the reset.
-- =============================================================================

ALTER TABLE trophies
  ADD COLUMN cover_focus_x smallint NOT NULL DEFAULT 50
    CHECK (cover_focus_x BETWEEN 0 AND 100),
  ADD COLUMN cover_focus_y smallint NOT NULL DEFAULT 50
    CHECK (cover_focus_y BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION _reset_trophy_cover_focus()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.cover_media_id IS DISTINCT FROM OLD.cover_media_id THEN
    NEW.cover_focus_x := 50;
    NEW.cover_focus_y := 50;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._reset_trophy_cover_focus() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER reset_trophy_cover_focus
  BEFORE UPDATE OF cover_media_id ON trophies
  FOR EACH ROW EXECUTE FUNCTION _reset_trophy_cover_focus();
