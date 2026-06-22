-- =============================================================================
-- Move event financial columns off the public events table.
--
-- `events.cost` and `events.payee_alias_cbu` (the payee's Mercado Pago alias /
-- CBU) were world-readable: events has a `using(true)` read policy for anon and
-- authenticated, so anyone could scrape every match cost and payment alias from
-- /rest/v1/events. In the UI these are shown only to admins (cost display) and
-- used only by mods+admins (the WhatsApp "compartir" message embeds the payee
-- and per-player cost) — never to basic users or logged-out visitors.
--
-- As with the players fix (20260622140000), the boundary must be RLS at the row
-- level, not a column grant. Split the two columns into their own table whose
-- read policy is is_mod_or_admin() and whose writes are is_admin() (event
-- creation and detail editing are both admin-only).
-- =============================================================================

CREATE TABLE event_finances (
  event_id bigint PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  cost integer,
  payee_alias_cbu text
);

-- Backfill existing financial data.
INSERT INTO event_finances (event_id, cost, payee_alias_cbu)
  SELECT id, cost, payee_alias_cbu
  FROM events
  WHERE cost IS NOT NULL OR payee_alias_cbu IS NOT NULL;

ALTER TABLE events
  DROP COLUMN cost,
  DROP COLUMN payee_alias_cbu;

ALTER TABLE event_finances ENABLE ROW LEVEL SECURITY;

-- Read: mods + admins (mods need it to build the share message).
CREATE POLICY "Mods read event_finances" ON event_finances
  FOR SELECT TO authenticated USING (is_mod_or_admin());

-- Write: admins only (creating events and editing details are admin-only).
CREATE POLICY "Admins insert event_finances" ON event_finances
  FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins update event_finances" ON event_finances
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
-- DELETE is handled by ON DELETE CASCADE from events; no direct-delete path.
