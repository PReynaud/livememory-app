-- Redeem a code and attach tokens in one step. A failed check does not burn
-- the code. Reuse deletes the grant. Refresh replay of the previous token
-- deletes the grant. Profile can see only grants that already have an access token.

alter table public.oauth_authorization_codes
  alter column grant_id drop not null;

alter table public.oauth_grants
  add column previous_refresh_token_hash text,
  add constraint oauth_grants_previous_refresh_hash_sha256 check (
    previous_refresh_token_hash is null
    or previous_refresh_token_hash ~ '^[a-f0-9]{64}$'
  );

create unique index oauth_grants_previous_refresh_token_hash_key
  on public.oauth_grants (previous_refresh_token_hash)
  where previous_refresh_token_hash is not null;

alter table public.oauth_grants
  add column has_access_token boolean
  generated always as (access_token_hash is not null) stored;

grant select (has_access_token) on table public.oauth_grants to authenticated;

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
  if p_client_name is null
    or p_client_name ~ '[[:cntrl:]]'
    or p_client_name ~ U&'[\200E\200F\202A-\202E\2066-\2069]'
    or v_name is null
    or length(v_name) < 1
    or length(v_name) > 120
  then
    raise exception 'invalid client name' using errcode = '22023';
  end if;

  if p_redirect_uris is null
    or cardinality(p_redirect_uris) < 1
    or cardinality(p_redirect_uris) > 8
  then
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
    null,
    p_redirect_uri,
    p_code_challenge,
    p_expires_at
  );

  return p_client_id;
end;
$$;

drop function if exists public.redeem_oauth_authorization_code(text, uuid, text, text);

create function public.redeem_oauth_authorization_code(
  p_code_hash text,
  p_client_id uuid,
  p_redirect_uri text,
  p_code_challenge text,
  p_access_hash text,
  p_access_expires_at timestamptz,
  p_refresh_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.oauth_authorization_codes%rowtype;
  v_grant_id uuid;
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
    delete from public.oauth_grants
    where id = v_row.grant_id;

    return jsonb_build_object('status', 'reused');
  end if;

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

  if v_row.grant_id is not null and not exists (
    select 1
    from public.oauth_grants as grant_row
    where grant_row.id = v_row.grant_id
  ) then
    return jsonb_build_object('status', 'revoked');
  end if;

  if p_access_hash !~ '^[a-f0-9]{64}$' or p_refresh_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid token hash' using errcode = '22023';
  end if;

  if v_row.grant_id is null then
    insert into public.oauth_grants (
      id,
      user_id,
      client_id,
      access_token_hash,
      access_expires_at,
      refresh_token_hash
    ) values (
      extensions.gen_random_uuid(),
      v_row.user_id,
      v_row.client_id,
      p_access_hash,
      p_access_expires_at,
      p_refresh_hash
    )
    returning id into v_grant_id;
  else
    update public.oauth_grants
    set access_token_hash = p_access_hash,
        access_expires_at = p_access_expires_at,
        refresh_token_hash = p_refresh_hash
    where id = v_row.grant_id
      and access_token_hash is null
    returning id into v_grant_id;

    if v_grant_id is null then
      raise exception 'grant not found' using errcode = '22023';
    end if;
  end if;

  update public.oauth_authorization_codes
  set used_at = pg_catalog.now(),
      grant_id = v_grant_id
  where code_hash = p_code_hash
    and used_at is null;

  if not found then
    raise exception 'authorization code already used' using errcode = '40001';
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'user_id', v_row.user_id,
    'grant_id', v_grant_id
  );
end;
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
  v_grant_id uuid;
begin
  if p_access_hash !~ '^[a-f0-9]{64}$' or p_next_refresh_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid token hash' using errcode = '22023';
  end if;

  select grant_row.id
    into v_grant_id
  from public.oauth_grants as grant_row
  where grant_row.previous_refresh_token_hash = p_refresh_hash
    and grant_row.client_id = p_client_id
  for update;

  if v_grant_id is not null then
    delete from public.oauth_grants
    where id = v_grant_id;

    return null;
  end if;

  update public.oauth_grants
  set previous_refresh_token_hash = refresh_token_hash,
      access_token_hash = p_access_hash,
      access_expires_at = p_access_expires_at,
      refresh_token_hash = p_next_refresh_hash
  where refresh_token_hash = p_refresh_hash
    and client_id = p_client_id
  returning user_id into v_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.redeem_oauth_authorization_code(text, uuid, text, text, text, timestamptz, text) from public;
revoke execute on function public.redeem_oauth_authorization_code(text, uuid, text, text, text, timestamptz, text) from anon, authenticated;
grant execute on function public.redeem_oauth_authorization_code(text, uuid, text, text, text, timestamptz, text) to service_role;
