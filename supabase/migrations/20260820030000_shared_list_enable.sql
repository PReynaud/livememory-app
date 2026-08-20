-- Shared List is off until the User enables it. Unauthenticated SELECT is
-- allowed only through this kernel public view of enabled usernames.
-- Disabled and unknown usernames are the same empty result.

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

grant select on table public.shared_list_profiles to anon, authenticated;
revoke all on table public.shared_list_profiles from public;

revoke all on table public.profiles from anon;
grant update (shared_list_enabled) on table public.profiles to authenticated;
