-- Fix Supabase lint warning: function has mutable search_path
create or replace function is_admin()
returns boolean language sql security definer stable
set search_path = ''
as $$
  select coalesce(
    auth.jwt() ->> 'email' in (
      'nicolas.venturo@gmail.com',
      'gustavobarbaresi@gmail.com'
    ), false
  )
$$;
