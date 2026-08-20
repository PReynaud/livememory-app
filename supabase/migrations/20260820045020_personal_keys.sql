-- Personal MCP keys: one hashed secret per User. Plaintext never lands in Postgres.
-- v1 is revoke-only (no expiry). Nitro looks up user_id via SECURITY DEFINER,
-- then mints a user-scoped JWT. service_role must not SELECT this table.

create table public.personal_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  key_hash text not null,
  created_at timestamptz not null default now(),
  constraint personal_keys_user_id_key unique (user_id),
  constraint personal_keys_key_hash_key unique (key_hash),
  constraint personal_keys_key_hash_sha256 check (key_hash ~ '^[a-f0-9]{64}$')
);

alter table public.personal_keys enable row level security;

create policy "Authenticated users can select own personal key metadata"
  on public.personal_keys
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert own personal key"
  on public.personal_keys
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete own personal key"
  on public.personal_keys
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.personal_keys from public, anon, authenticated, service_role;
grant select, insert, delete on table public.personal_keys to authenticated;

create or replace function public.lookup_personal_key_user(key_hash text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pk.user_id
  from public.personal_keys as pk
  where pk.key_hash = lookup_personal_key_user.key_hash
  limit 1;
$$;

revoke all on function public.lookup_personal_key_user(text) from public;
revoke execute on function public.lookup_personal_key_user(text) from anon, authenticated;
grant execute on function public.lookup_personal_key_user(text) to service_role;
