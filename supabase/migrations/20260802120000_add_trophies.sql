-- =============================================================================
-- Trofeos: the matches and tournaments worth remembering.
--
-- A trophy is a title, a date, the people who were part of it, and photos —
-- one of which is the cover the list is built on. There is no physical trophy
-- behind any of these; the representative image is the celebration, so the
-- cover is a real column and not an afterthought.
--
-- Two modelling decisions are load-bearing:
--
--   * The participant list is its OWN table, never derived from the linked
--     event. A league final is not played by everyone who turned up to the
--     league, so "who was part of this" and "who attended that fecha" are
--     different sets and the app must not conflate them. event_id is a link
--     for context (and photos), not the source of the roster.
--
--   * The cover is a media row of THIS trophy, enforced structurally: media
--     gains a trophy_id, a UNIQUE (trophy_id, id) makes it an FK target, and
--     trophies.cover_media_id references it composite-ly — the 20260802100001
--     "this child belongs to this parent" pattern. A cover that is some other
--     trophy's photo is unrepresentable rather than merely discouraged.
--
-- A photo belongs to a trophy or to the gallery, never to both: `trophy_id`
-- being set is exactly what keeps it out of the gallery's queries, so the
-- trophy page is the one place its photos appear.
--
-- Deletion semantics differ on purpose between the two directions:
--   * Deleting a trophy SET NULLs its photos' trophy_id, which releases them
--     into the gallery — a celebration photo is still a good photo of the club,
--     so the trophy going away must not take it down with it.
--   * Deleting a player is REFUSED while they are on a trophy, matching how
--     every other trace of a player already behaves (20260802110003).
-- =============================================================================


-- ─── 1. Trophies ────────────────────────────────────────────────────────────

CREATE TABLE trophies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL CHECK (length(trim(title)) > 0 AND length(title) <= 120),
  won_at date NOT NULL,
  -- Optional link to the fecha it was won at. SET NULL, not CASCADE: the
  -- trophy is the record that matters and it outlives the event row. NULL also
  -- covers wins from before the app existed.
  event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  -- FK added in step 3, once media.trophy_id exists to point at.
  cover_media_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trophies_event_id_idx ON trophies (event_id);

-- ─── 2. Who was part of it ──────────────────────────────────────────────────

CREATE TABLE trophy_participants (
  trophy_id bigint NOT NULL REFERENCES trophies(id) ON DELETE CASCADE,
  -- RESTRICT for the same reason as event_participants: a player's history
  -- must not disappear silently behind a confirm dialog.
  player_id bigint NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  PRIMARY KEY (trophy_id, player_id)
);

CREATE INDEX trophy_participants_player_id_idx ON trophy_participants (player_id);

-- ─── 3. Photos, and the cover among them ────────────────────────────────────

-- SET NULL rather than CASCADE: dropping the trophy must not destroy the
-- photos, which remain valid gallery items on their own.
ALTER TABLE media ADD COLUMN trophy_id bigint REFERENCES trophies(id) ON DELETE SET NULL;

CREATE INDEX media_trophy_id_idx ON media (trophy_id);

-- Composite FK target. media.id is already unique on its own, so this key
-- exists purely so the cover reference below can carry "…and it belongs to
-- this trophy" in the constraint itself.
ALTER TABLE media ADD CONSTRAINT media_trophy_id_id_key UNIQUE (trophy_id, id);

-- MATCH SIMPLE: while cover_media_id is NULL the check is skipped, so a trophy
-- can exist before its photos are uploaded. Deleting the cover photo clears
-- the pointer instead of blocking the delete.
ALTER TABLE trophies
  ADD CONSTRAINT trophies_cover_media_id_fkey
  FOREIGN KEY (id, cover_media_id) REFERENCES media (trophy_id, id)
  ON DELETE SET NULL (cover_media_id);

-- ─── 4. A trophy with photos always has a cover ─────────────────────────────
--
-- The cover is what the whole list is built on, so "has photos but shows the
-- placeholder" is a state worth making unreachable rather than asking an admin
-- to remember. Two rules, both enforced here instead of in the client, so they
-- hold whatever path adds or removes a photo:
--
--   * a photo joining a trophy that has no cover becomes the cover;
--   * losing the cover photo promotes another of the trophy's photos.
--
-- The second rule has to survive running either side of the FK's own
-- ON DELETE SET NULL (the firing order of a user AFTER trigger against an RI
-- trigger is not something to depend on), hence the two-armed WHERE: it matches
-- while the pointer still names the doomed row, and again once the FK has
-- nulled it. Whichever runs first, the other finds nothing to do.
--
-- Permission note, deliberate: this is SECURITY DEFINER, so a mod — who can
-- upload photos but holds no UPDATE on trophies — does set the cover by
-- uploading the first one. That is the intended behaviour, and it is bounded:
-- it can only ever point at a photo that has just been added, and only while
-- there is no cover to overwrite.

CREATE OR REPLACE FUNCTION _keep_trophy_cover_current()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP <> 'DELETE' AND NEW.trophy_id IS NOT NULL THEN
    UPDATE public.trophies
       SET cover_media_id = NEW.id
     WHERE id = NEW.trophy_id AND cover_media_id IS NULL;
  END IF;

  IF TG_OP <> 'INSERT' AND OLD.trophy_id IS NOT NULL THEN
    UPDATE public.trophies
       SET cover_media_id = (
             SELECT m.id FROM public.media m
             WHERE m.trophy_id = OLD.trophy_id
             ORDER BY m.id
             LIMIT 1)
     WHERE id = OLD.trophy_id
       AND (cover_media_id IS NULL OR cover_media_id = OLD.id);
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._keep_trophy_cover_current() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER keep_trophy_cover_current
  AFTER INSERT OR DELETE OR UPDATE OF trophy_id ON media
  FOR EACH ROW EXECUTE FUNCTION _keep_trophy_cover_current();

-- ─── 5. RLS ─────────────────────────────────────────────────────────────────
--
-- Everyone reads. Writes are admin-only: a handful of rows a year does not
-- need a broader permission, and unlike a matchday roster there is no
-- day-to-day upkeep for a mod to do. Photos are the exception and need no work
-- here — they are `media` rows and already follow the mods-can-upload policies
-- from 20260425120000.

ALTER TABLE trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select trophies" ON trophies FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select trophies" ON trophies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert trophies" ON trophies FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update trophies" ON trophies FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete trophies" ON trophies FOR DELETE TO authenticated USING (is_admin());

ALTER TABLE trophy_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select trophy_participants" ON trophy_participants FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can select trophy_participants" ON trophy_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert trophy_participants" ON trophy_participants FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can delete trophy_participants" ON trophy_participants FOR DELETE TO authenticated USING (is_admin());

-- ─── 6. A trophy counts as history when deleting a player ───────────────────
--
-- Extends the explanation trigger from 20260802110003 with the new reason.
-- Same rules as there: no is_admin() (this is integrity, not permission), and
-- gender-neutral phrasing, since players.gender does not decide the
-- grammatical gender of every name.

CREATE OR REPLACE FUNCTION _explain_player_delete_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_events bigint;
  v_photos bigint;
  v_awards bigint;
  v_trophies bigint;
  v_reasons text[] := '{}';
BEGIN
  SELECT count(*) INTO v_events
  FROM public.event_participants WHERE player_id = OLD.id;

  SELECT count(*) INTO v_photos
  FROM public.media_player_tags WHERE player_id = OLD.id;

  SELECT count(*) INTO v_awards
  FROM public.event_award_resolutions WHERE player_id = OLD.id;

  SELECT count(*) INTO v_trophies
  FROM public.trophy_participants WHERE player_id = OLD.id;

  IF v_awards > 0 THEN
    v_reasons := v_reasons || format('ganó %s premio%s', v_awards, CASE WHEN v_awards = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_trophies > 0 THEN
    v_reasons := v_reasons || format('está en %s trofeo%s', v_trophies, CASE WHEN v_trophies = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_events > 0 THEN
    v_reasons := v_reasons || format('participó en %s fecha%s', v_events, CASE WHEN v_events = 1 THEN '' ELSE 's' END);
  END IF;
  IF v_photos > 0 THEN
    v_reasons := v_reasons || format('tiene %s etiqueta%s en fotos', v_photos, CASE WHEN v_photos = 1 THEN '' ELSE 's' END);
  END IF;

  IF array_length(v_reasons, 1) > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar a % porque %. Primero quitá esos registros.',
      OLD.name, array_to_string(v_reasons, ', ');
  END IF;

  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._explain_player_delete_block() FROM PUBLIC, anon, authenticated;
