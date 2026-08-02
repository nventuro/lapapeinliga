-- =============================================================================
-- Cheap, independent hardening decided consciously (db_plan item 4).
--
-- 1. Case-insensitive uniqueness where duplicates hurt:
--    * media_tags.name was case-SENSITIVE unique, so 'Asado' and 'asado'
--      forked a tag. The exact-match constraint is replaced by a unique index
--      on lower(name) (which subsumes it).
--    * locations.name had no uniqueness at all — the "new location" flow could
--      create duplicate venues.
--    Both get a defensive dedup backfill first (merge assignments/references
--    into the lowest id, drop the rest). Live data probed 2026-08-01 had no
--    duplicates, so these are expected no-ops.
--    Team names are consciously NOT deduplicated: duplicates within one event
--    are immediately visible user error, and every relation keys on team ids.
--
-- 2. created_at audit columns, DEFAULT now(), nullable — NULL means the row
--    predates auditing (backfilling migration-time stamps would fabricate
--    history). Skipped on event_feedback deliberately: feedback is anonymous,
--    and a creation timestamp correlates submissions with voters.
--
-- 3. created_by is consciously NOT added: these tables are world-readable and
--    write access maps to roles, so recording the author would let anyone
--    enumerate who the admins/mods are — which 20260417120000 deliberately
--    hides. Proper actor attribution needs an RLS-gated audit table; deferred.
--
-- 4. events.short_id generation gets a collision-retry loop. The old inline
--    DEFAULT drew 28 random bits with no retry, so an unlucky INSERT simply
--    failed against the unique index. The unique index stays as the backstop
--    for the (now astronomically unlikely) concurrent-collision case.
-- =============================================================================


-- ─── 1a. media_tags: merge case-insensitive duplicates, unique on lower ─────

CREATE TEMP TABLE _dup_tags ON COMMIT DROP AS
  SELECT mt.id AS loser_id, c.keep_id
  FROM media_tags mt
  JOIN (
    SELECT min(id) AS keep_id, lower(name) AS lname
    FROM media_tags GROUP BY lower(name)
  ) c ON lower(mt.name) = c.lname
  WHERE mt.id <> c.keep_id;

-- Re-point assignments to the surviving tag, unless that media item already
-- carries it (then the duplicate assignment is simply dropped below).
UPDATE media_tag_assignments a
  SET tag_id = d.keep_id
  FROM _dup_tags d
  WHERE a.tag_id = d.loser_id
    AND NOT EXISTS (
      SELECT 1 FROM media_tag_assignments a2
      WHERE a2.media_id = a.media_id AND a2.tag_id = d.keep_id
    );

DELETE FROM media_tag_assignments a USING _dup_tags d WHERE a.tag_id = d.loser_id;
DELETE FROM media_tags mt USING _dup_tags d WHERE mt.id = d.loser_id;

ALTER TABLE media_tags DROP CONSTRAINT media_tags_name_key;
CREATE UNIQUE INDEX media_tags_name_lower_idx ON media_tags (lower(name));

-- ─── 1b. locations: merge case-insensitive duplicates, unique on lower ──────

CREATE TEMP TABLE _dup_locations ON COMMIT DROP AS
  SELECT l.id AS loser_id, c.keep_id
  FROM locations l
  JOIN (
    SELECT min(id) AS keep_id, lower(name) AS lname
    FROM locations GROUP BY lower(name)
  ) c ON lower(l.name) = c.lname
  WHERE l.id <> c.keep_id;

-- events.location_id is the only reference to locations.
UPDATE events e
  SET location_id = d.keep_id
  FROM _dup_locations d
  WHERE e.location_id = d.loser_id;

DELETE FROM locations l USING _dup_locations d WHERE l.id = d.loser_id;

CREATE UNIQUE INDEX locations_name_lower_idx ON locations (lower(name));

-- ─── 2. created_at audit columns ────────────────────────────────────────────

ALTER TABLE players            ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE events             ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE locations          ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE external_teams     ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE media              ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE media_tags         ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE event_teams        ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE event_participants ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE tournament_matches ADD COLUMN created_at timestamptz DEFAULT now();
ALTER TABLE event_finances     ADD COLUMN created_at timestamptz DEFAULT now();

-- ─── 3. short_id generation with collision retry ────────────────────────────

CREATE OR REPLACE FUNCTION generate_event_short_id()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate text;
  v_attempt int := 0;
BEGIN
  LOOP
    -- pgcrypto lives in the `extensions` schema (Supabase default), and the
    -- pinned empty search_path means it must be qualified here.
    v_candidate := substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 7);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE short_id = v_candidate);
    v_attempt := v_attempt + 1;
    -- 20 collisions in a row means something is deeply wrong (or the 28-bit
    -- space is essentially full); fail rather than spin.
    IF v_attempt >= 20 THEN
      RAISE EXCEPTION 'No se pudo generar un identificador único';
    END IF;
  END LOOP;
  RETURN v_candidate;
END;
$$;

-- plpgsql resolves identifiers at runtime, so a bad schema reference above
-- would otherwise only surface on the next event INSERT. Exercise the
-- function now: if it cannot run, the migration fails instead of production.
DO $$
BEGIN
  PERFORM public.generate_event_short_id();
END $$;

-- Only event creation (an authenticated admin, via the column DEFAULT) needs
-- to call this; keep it out of the anon-facing RPC surface.
REVOKE EXECUTE ON FUNCTION public.generate_event_short_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_event_short_id() TO authenticated;

ALTER TABLE events ALTER COLUMN short_id SET DEFAULT public.generate_event_short_id();
