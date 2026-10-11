-- OAuth 2.1 for MCP: public clients, single-use codes, user-owned grants.
-- Secrets are SHA-256 hashes. service_role cannot read these tables; Nitro
-- resolves a hash through SECURITY DEFINER lookups and then mints a user JWT.
-- Domain tables (events, concerts, attendance, membership, stages) are untouched.

drop function if exists public.lookup_personal_key_user(text);
drop table if exists public.personal_keys;

create or replace function public.oauth_redirect_uri_allowed(uri text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select uri ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[^\s#]*)?$'
      or uri ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/[^\s#]*)?$';
$$;

create table public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  redirect_uris text[] not null,
  created_at timestamptz not null default now(),
  constraint oauth_clients_name_nonempty check (length(btrim(client_name)) between 1 and 120),
  constraint oauth_clients_redirect_uris_nonempty check (cardinality(redirect_uris) > 0)
);

create table public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid not null references public.oauth_clients (id) on delete cascade,
  access_token_hash text,
  access_expires_at timestamptz,
  refresh_token_hash text,
  created_at timestamptz not null default now(),
  constraint oauth_grants_access_hash_sha256 check (
    access_token_hash is null or access_token_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint oauth_grants_refresh_hash_sha256 check (
    refresh_token_hash is null or refresh_token_hash ~ '^[a-f0-9]{64}$'
  )
);

create unique index oauth_grants_access_token_hash_key
  on public.oauth_grants (access_token_hash)
  where access_token_hash is not null;

create unique index oauth_grants_refresh_token_hash_key
  on public.oauth_grants (refresh_token_hash)
  where refresh_token_hash is not null;

create index oauth_grants_user_id_idx
  on public.oauth_grants (user_id);

create table public.oauth_authorization_codes (
  code_hash text primary key,
  client_id uuid not null references public.oauth_clients (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  grant_id uuid not null references public.oauth_grants (id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint oauth_authorization_codes_hash_sha256 check (code_hash ~ '^[a-f0-9]{64}$'),
  constraint oauth_authorization_codes_challenge_s256 check (code_challenge ~ '^[A-Za-z0-9_-]{43}$')
);

alter table public.oauth_clients enable row level security;
alter table public.oauth_grants enable row level security;
alter table public.oauth_authorization_codes enable row level security;

create policy "Authenticated users can select oauth clients"
  on public.oauth_clients
  for select
  to authenticated
  using (true);

create policy "Authenticated users can select own oauth grants"
  on public.oauth_grants
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can delete own oauth grants"
  on public.oauth_grants
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.oauth_clients from public, anon, authenticated, service_role;
grant select (id, client_name) on table public.oauth_clients to authenticated;

revoke all on table public.oauth_grants from public, anon, authenticated, service_role;
grant select (id, user_id, client_id, created_at) on table public.oauth_grants to authenticated;
grant delete on table public.oauth_grants to authenticated;

revoke all on table public.oauth_authorization_codes from public, anon, authenticated, service_role;

create or replace function public.register_oauth_client(
  p_client_name text,
  p_redirect_uris text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := btrim(p_client_name);
begin
  if v_name is null or length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'invalid client name' using errcode = '22023';
  end if;

  if p_redirect_uris is null or cardinality(p_redirect_uris) < 1 then
    raise exception 'invalid redirect uri' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_redirect_uris) as uri
    where not public.oauth_redirect_uri_allowed(uri)
  ) then
    raise exception 'invalid redirect uri' using errcode = '22023';
  end if;

  insert into public.oauth_clients (id, client_name, redirect_uris)
  values (extensions.gen_random_uuid(), v_name, p_redirect_uris)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.oauth_client_for_redirect(
  p_client_id uuid,
  p_redirect_uri text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not public.oauth_redirect_uri_allowed(p_redirect_uri) then
    return null;
  end if;

  select client.client_name
    into v_name
  from public.oauth_clients as client
  where client.id = p_client_id
    and p_redirect_uri = any (client.redirect_uris);

  if v_name is null then
    return null;
  end if;

  return jsonb_build_object('client_id', p_client_id, 'client_name', v_name);
end;
$$;

create or replace function public.issue_oauth_authorization_code(
  p_user_id uuid,
  p_client_id uuid,
  p_redirect_uri text,
  p_code_challenge text,
  p_code_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant_id uuid;
  v_client jsonb;
begin
  if p_user_id is null
    or p_code_hash !~ '^[a-f0-9]{64}$'
    or p_code_challenge !~ '^[A-Za-z0-9_-]{43}$'
  then
    raise exception 'invalid authorization request' using errcode = '22023';
  end if;

  v_client := public.oauth_client_for_redirect(p_client_id, p_redirect_uri);
  if v_client is null then
    raise exception 'redirect uri is not registered' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_user_id
  ) then
    raise exception 'user not found' using errcode = '22023';
  end if;

  insert into public.oauth_grants (id, user_id, client_id)
  values (extensions.gen_random_uuid(), p_user_id, p_client_id)
  returning id into v_grant_id;

  insert into public.oauth_authorization_codes (
    code_hash,
    client_id,
    user_id,
    grant_id,
    redirect_uri,
    code_challenge,
    expires_at
  ) values (
    p_code_hash,
    p_client_id,
    p_user_id,
    v_grant_id,
    p_redirect_uri,
    p_code_challenge,
    p_expires_at
  );

  return v_grant_id;
end;
$$;

create or replace function public.redeem_oauth_authorization_code(
  p_code_hash text,
  p_client_id uuid,
  p_redirect_uri text,
  p_code_challenge text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.oauth_authorization_codes%rowtype;
begin
  select *
    into v_row
  from public.oauth_authorization_codes
  where code_hash = p_code_hash
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_row.used_at is not null then
    return jsonb_build_object('status', 'reused');
  end if;

  update public.oauth_authorization_codes
  set used_at = pg_catalog.now()
  where code_hash = p_code_hash;

  if v_row.expires_at <= pg_catalog.now() then
    return jsonb_build_object('status', 'expired');
  end if;

  if v_row.client_id is distinct from p_client_id
    or v_row.redirect_uri is distinct from p_redirect_uri
  then
    return jsonb_build_object('status', 'redirect_mismatch');
  end if;

  if v_row.code_challenge is distinct from p_code_challenge then
    return jsonb_build_object('status', 'bad_verifier');
  end if;

  if not exists (
    select 1
    from public.oauth_grants as grant_row
    where grant_row.id = v_row.grant_id
  ) then
    return jsonb_build_object('status', 'revoked');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'user_id', v_row.user_id,
    'grant_id', v_row.grant_id
  );
end;
$$;

create or replace function public.attach_oauth_grant_tokens(
  p_grant_id uuid,
  p_access_hash text,
  p_access_expires_at timestamptz,
  p_refresh_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_access_hash !~ '^[a-f0-9]{64}$' or p_refresh_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid token hash' using errcode = '22023';
  end if;

  update public.oauth_grants
  set access_token_hash = p_access_hash,
      access_expires_at = p_access_expires_at,
      refresh_token_hash = p_refresh_hash
  where id = p_grant_id
    and access_token_hash is null;

  if not found then
    raise exception 'grant not found' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.lookup_oauth_access_token(p_token_hash text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select grant_row.user_id
  from public.oauth_grants as grant_row
  where grant_row.access_token_hash = p_token_hash
    and grant_row.access_expires_at > pg_catalog.now()
  limit 1;
$$;

create or replace function public.rotate_oauth_refresh_token(
  p_refresh_hash text,
  p_client_id uuid,
  p_access_hash text,
  p_access_expires_at timestamptz,
  p_next_refresh_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_access_hash !~ '^[a-f0-9]{64}$' or p_next_refresh_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid token hash' using errcode = '22023';
  end if;

  update public.oauth_grants
  set access_token_hash = p_access_hash,
      access_expires_at = p_access_expires_at,
      refresh_token_hash = p_next_refresh_hash
  where refresh_token_hash = p_refresh_hash
    and client_id = p_client_id
  returning user_id into v_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.oauth_redirect_uri_allowed(text) from public;
revoke execute on function public.oauth_redirect_uri_allowed(text) from anon, authenticated;
grant execute on function public.oauth_redirect_uri_allowed(text) to service_role;

revoke all on function public.register_oauth_client(text, text[]) from public;
revoke execute on function public.register_oauth_client(text, text[]) from anon, authenticated;
grant execute on function public.register_oauth_client(text, text[]) to service_role;

revoke all on function public.oauth_client_for_redirect(uuid, text) from public;
revoke execute on function public.oauth_client_for_redirect(uuid, text) from anon, authenticated;
grant execute on function public.oauth_client_for_redirect(uuid, text) to service_role;

revoke all on function public.issue_oauth_authorization_code(uuid, uuid, text, text, text, timestamptz) from public;
revoke execute on function public.issue_oauth_authorization_code(uuid, uuid, text, text, text, timestamptz) from anon, authenticated;
grant execute on function public.issue_oauth_authorization_code(uuid, uuid, text, text, text, timestamptz) to service_role;

revoke all on function public.redeem_oauth_authorization_code(text, uuid, text, text) from public;
revoke execute on function public.redeem_oauth_authorization_code(text, uuid, text, text) from anon, authenticated;
grant execute on function public.redeem_oauth_authorization_code(text, uuid, text, text) to service_role;

revoke all on function public.attach_oauth_grant_tokens(uuid, text, timestamptz, text) from public;
revoke execute on function public.attach_oauth_grant_tokens(uuid, text, timestamptz, text) from anon, authenticated;
grant execute on function public.attach_oauth_grant_tokens(uuid, text, timestamptz, text) to service_role;

revoke all on function public.lookup_oauth_access_token(text) from public;
revoke execute on function public.lookup_oauth_access_token(text) from anon, authenticated;
grant execute on function public.lookup_oauth_access_token(text) to service_role;

revoke all on function public.rotate_oauth_refresh_token(text, uuid, text, timestamptz, text) from public;
revoke execute on function public.rotate_oauth_refresh_token(text, uuid, text, timestamptz, text) from anon, authenticated;
grant execute on function public.rotate_oauth_refresh_token(text, uuid, text, timestamptz, text) to service_role;
