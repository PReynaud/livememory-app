-- Representative rows so the latest migration is applied on existing data.
-- Local `db reset` runs migrations on an empty public schema (seed comes after),
-- which hides failures such as CREATE INDEX after UPDATE (SQLSTATE 55006).

do $$
declare
  owner_id uuid := '11111111-1111-4111-8111-111111111111';
  event_id uuid := '22222222-2222-4222-8222-222222222222';
  stage_id uuid := '33333333-3333-4333-8333-333333333333';
  concert_id uuid := '44444444-4444-4444-8444-444444444444';
  concert_cols text := 'id, event_id, artist, date, "time", place';
  concert_vals text;
begin
  if to_regclass('auth.users') is null then
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    owner_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'existing-data-check@example.com',
    crypt('not-used', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"existingdatacheck"}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;

  if to_regclass('public.events') is null then
    return;
  end if;

  insert into public.events (id, owner_id, kind, name, start_date, end_date, place)
  values (event_id, owner_id, 'single_night', 'Existing Night', '2026-08-18', '2026-08-18', 'Paris');

  if to_regclass('public.event_stages') is not null then
    insert into public.event_stages (id, event_id, name)
    values (stage_id, event_id, 'Main Stage');
  end if;

  if to_regclass('public.concerts') is null then
    return;
  end if;

  concert_vals := format(
    '%L, %L, %L, %L, %L, %L',
    concert_id,
    event_id,
    'Existing Artist',
    '2026-08-18',
    '20:00',
    'Paris'
  );

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'concerts'
      and column_name = 'owner_id'
  ) then
    concert_cols := concert_cols || ', owner_id';
    concert_vals := concert_vals || format(', %L', owner_id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'concerts'
      and column_name = 'stage_id'
  ) and to_regclass('public.event_stages') is not null then
    concert_cols := concert_cols || ', stage_id';
    concert_vals := concert_vals || format(', %L', stage_id);
  end if;

  execute format('insert into public.concerts (%s) values (%s)', concert_cols, concert_vals);
end;
$$;
