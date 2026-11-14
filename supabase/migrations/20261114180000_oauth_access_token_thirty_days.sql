-- Access tokens last 30 days (set by the token endpoint). Refresh tokens stay
-- stable until the user revokes the grant. Replaying the current or previous
-- refresh token renews the access token and does not delete the grant.
-- The immediately previous access token stays valid until the expiry it was
-- issued with, so an import already in flight keeps working after one refresh.

alter table public.oauth_grants
  add column previous_access_token_hash text,
  add column previous_access_expires_at timestamptz,
  add constraint oauth_grants_previous_access_hash_sha256 check (
    previous_access_token_hash is null
    or previous_access_token_hash ~ '^[a-f0-9]{64}$'
  );

create unique index oauth_grants_previous_access_token_hash_key
  on public.oauth_grants (previous_access_token_hash)
  where previous_access_token_hash is not null;

create or replace function public.lookup_oauth_access_token(p_token_hash text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_count int;
begin
  select count(*)
    into v_count
  from public.oauth_grants as grant_row
  where (
      grant_row.access_token_hash = p_token_hash
      and grant_row.access_expires_at > pg_catalog.now()
    )
    or (
      grant_row.previous_access_token_hash = p_token_hash
      and grant_row.previous_access_expires_at > pg_catalog.now()
    );

  if v_count <> 1 then
    return null;
  end if;

  select grant_row.user_id
    into v_user_id
  from public.oauth_grants as grant_row
  where (
      grant_row.access_token_hash = p_token_hash
      and grant_row.access_expires_at > pg_catalog.now()
    )
    or (
      grant_row.previous_access_token_hash = p_token_hash
      and grant_row.previous_access_expires_at > pg_catalog.now()
    );

  return v_user_id;
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
  v_count int;
begin
  if p_access_hash is null
    or p_next_refresh_hash is null
    or p_access_hash !~ '^[a-f0-9]{64}$'
    or p_next_refresh_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid token hash' using errcode = '22023';
  end if;

  select count(*)
    into v_count
  from public.oauth_grants as grant_row
  where grant_row.client_id = p_client_id
    and (
      grant_row.refresh_token_hash = p_refresh_hash
      or grant_row.previous_refresh_token_hash = p_refresh_hash
    );

  if v_count <> 1 then
    return null;
  end if;

  update public.oauth_grants
  set previous_access_token_hash = access_token_hash,
      previous_access_expires_at = access_expires_at,
      access_token_hash = p_access_hash,
      access_expires_at = p_access_expires_at
  where client_id = p_client_id
    and (
      refresh_token_hash = p_refresh_hash
      or previous_refresh_token_hash = p_refresh_hash
    )
  returning user_id into v_user_id;

  return v_user_id;
end;
$$;
