-- Fix Supabase lint warning: view players_public is SECURITY DEFINER.
--
-- Switch to security_invoker so the view runs with the *caller's* privileges
-- and RLS is respected. This requires:
--   1. RLS SELECT policies on `players` for anon and authenticated
--   2. Column-level SELECT grants (omitting `rating`) so callers can only
--      read the columns exposed in the view
--
-- Safety net: if a new column is added to `players` and included in the view
-- but the column-level grant is not updated, the query will fail loudly
-- (permission denied) rather than silently leaking data.

-- 1. Allow anon and authenticated to SELECT from the players table via RLS
create policy "Anon can select players" on players
  for select to anon using (true);

create policy "Authenticated can select players" on players
  for select to authenticated using (true);

-- 2. Column-level grants — expose everything except `rating`
grant select (id, name, gender, tier) on players to anon, authenticated;

-- 3. Recreate the view with security_invoker = true
drop view players_public;

create view players_public
  with (security_invoker = true)
  as select id, name, gender, tier from players;

grant select on players_public to anon, authenticated;
