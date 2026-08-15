-- Profiles table with RLS. One row per auth user.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Authenticated users can select own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Authenticated users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Authenticated users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
