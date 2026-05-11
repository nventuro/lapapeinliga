-- Allows a claimed player to rename themselves (name column only).
-- SECURITY DEFINER so it can update the players table without exposing
-- a broad RLS UPDATE policy that would allow editing any column.
CREATE OR REPLACE FUNCTION update_my_player_name(new_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trimmed text := trim(new_name);
BEGIN
  IF trimmed = '' THEN
    RAISE EXCEPTION 'name cannot be empty';
  END IF;

  UPDATE players
  SET name = trimmed
  WHERE email = auth.jwt() ->> 'email';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no player linked to current user';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_player_name(text) TO authenticated;
