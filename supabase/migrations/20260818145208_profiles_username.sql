-- Replace factory display_name with an immutable unique username.

alter table public.profiles
  add column username text;

update public.profiles
set username = display_name
where username is null
  and display_name ~ '^[A-Za-z0-9_-]+$';

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
