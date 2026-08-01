-- =============================================================================
-- Migration: Add the 'social' event type
--
-- A social event is a get-together with no players involved: the event row
-- itself (name, date, time, location) plus whatever photos get uploaded for it.
-- There is no roster, no result, no awards and no cost split, so unlike the
-- other four types it gets no child table -- the events row IS the whole
-- record, and a child table would only ever hold a foreign key.
--
-- Everything downstream is already fail-closed for an unknown type:
--   * event_participants (drives cost-per-player and photo tagging) has one
--     branch per rostered type, so social events contribute no rows.
--   * the award-vote and feedback RPCs reject any event whose type is not in
--     ('match','tournament'), so voting/feedback stay off without changes.
--   * event_finances is keyed per event rather than per type; it stays usable
--     but the UI never offers cost/payee for social events.
-- =============================================================================

ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('match', 'training', 'tournament', 'external_match', 'social'));
