-- Shared List is off until the User enables it. The kernel view names the
-- public rows. Unauthenticated reads go through a single-username lookup so
-- v1 has no User directory. Disabled and unknown usernames are the same empty result.

alter table public.profiles
  add column shared_list_enabled boolean not null default false;

create index profiles_shared_list_enabled_username_idx
  on public.profiles (lower(username))
  where shared_list_enabled;

create view public.shared_list_profiles
with (security_invoker = false)
as
select
  profiles.username,
  lower(profiles.username) as username_key
from public.profiles
where profiles.shared_list_enabled;

revoke all on table public.shared_list_profiles from public, anon, authenticated;

create or replace function public.get_shared_list_profile(requested text)
returns table (username text)
language sql
stable
security definer
set search_path = public
as $$
  select shared_list_profiles.username
  from public.shared_list_profiles
  where shared_list_profiles.username_key = lower(btrim(requested))
  limit 1;
$$;

revoke all on function public.get_shared_list_profile(text) from public;
grant execute on function public.get_shared_list_profile(text) to anon, authenticated;

revoke all on table public.profiles from anon;
grant update (shared_list_enabled) on table public.profiles to authenticated;
