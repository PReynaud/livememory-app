-- Replace factory display_name with an immutable unique username.

alter table public.profiles
  add column username text;

update public.profiles
set username = display_name
where username is null
  and display_name ~ '^[A-Za-z0-9_-]+$';

-- Keep one row when two valid display_names collide case-insensitively.
update public.profiles as later
set username = null
where later.username is not null
  and exists (
    select 1
    from public.profiles as earlier
    where earlier.id < later.id
      and earlier.username is not null
      and lower(earlier.username) = lower(later.username)
  );

-- Legacy factory names (email local-parts with `.` / `+`, leftover collisions)
-- get a deterministic unique handle from the row id.
update public.profiles
set username = 'u' || replace(id::text, '-', '')
where username is null;

alter table public.profiles
  drop column display_name;

alter table public.profiles
  alter column username set not null;

alter table public.profiles
  add constraint profiles_username_charset_check
  check (username ~ '^[A-Za-z0-9_-]+$');

create unique index profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  username_value text;
begin
  username_value := nullif(btrim(new.raw_user_meta_data ->> 'username'), '');

  if username_value is null or username_value !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'Username is required';
  end if;

  insert into public.profiles (id, username)
  values (
    new.id,
    username_value
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Boolean-only lookup so register can tell a unique collision from other
-- trigger failures. SECURITY DEFINER is required because own-row RLS would
-- hide other usernames from anon.
create or replace function public.username_is_taken(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where lower(username) = lower(candidate)
  );
$$;

revoke all on function public.username_is_taken(text) from public;
grant execute on function public.username_is_taken(text) to anon, authenticated;

create or replace function public.prevent_username_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.username is distinct from old.username then
    raise exception 'Username cannot be changed';
  end if;

  return new;
end;
$$;

create trigger profiles_username_immutable
  before update on public.profiles
  for each row
  execute function public.prevent_username_update();

revoke execute on function public.prevent_username_update() from public, anon, authenticated;
