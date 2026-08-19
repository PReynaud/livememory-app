-- Event Place-override, Stage/Scene rows, Concert stage_id, and Bill kernel.
-- Hard rules live here (NFR-15): inclusive Event dates, inherited Place unless
-- override is on, and stage required only when the Event has stage rows.
-- Combined Event+Concert date save uses a SECURITY INVOKER function because
-- two PostgREST statements cannot share a transaction (AD-13).

alter table public.events
  add column allow_place_override boolean not null default false;

create table public.event_stages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  constraint event_stages_name_not_blank check (char_length(trim(name)) > 0)
);

create unique index event_stages_event_id_lower_name_idx
  on public.event_stages (event_id, lower(name));

create index event_stages_event_id_idx
  on public.event_stages (event_id);

alter table public.concerts
  add column stage_id uuid references public.event_stages (id) on delete set null;

create index concerts_stage_id_idx
  on public.concerts (stage_id);

alter table public.event_stages enable row level security;

grant select, insert, update, delete on table public.event_stages to authenticated;

create policy "Authenticated users can select stages on owned events"
  on public.event_stages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_stages.event_id
        and events.owner_id = (select auth.uid())
    )
  );

create policy "Authenticated users can insert stages on owned events"
  on public.event_stages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events
      where events.id = event_stages.event_id
        and events.owner_id = (select auth.uid())
    )
  );

create policy "Authenticated users can update stages on owned events"
  on public.event_stages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_stages.event_id
        and events.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.events
      where events.id = event_stages.event_id
        and events.owner_id = (select auth.uid())
    )
  );

create policy "Authenticated users can delete stages on owned events"
  on public.event_stages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_stages.event_id
        and events.owner_id = (select auth.uid())
    )
  );

create or replace function public.concert_event_rule_violation(concert public.concerts)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  ev public.events%rowtype;
  stage_count integer;
begin
  select *
    into ev
  from public.events
  where id = concert.event_id;

  if not found then
    return 'Event is required.';
  end if;

  if concert.date < ev.start_date or concert.date > ev.end_date then
    return 'This date is outside the Event.';
  end if;

  if ev.allow_place_override = false and concert.place is distinct from ev.place then
    return 'This Place conflicts with the Event Place.';
  end if;

  select count(*)
    into stage_count
  from public.event_stages
  where event_id = ev.id;

  if stage_count > 0 then
    if concert.stage_id is null then
      return 'Stage or Scene is required.';
    end if;

    if not exists (
      select 1
      from public.event_stages
      where id = concert.stage_id
        and event_id = ev.id
    ) then
      return 'Stage or Scene must be on this Event.';
    end if;
  elsif concert.stage_id is not null then
    return 'Stage or Scene must be on this Event.';
  end if;

  return null;
end;
$$;

revoke execute on function public.concert_event_rule_violation(public.concerts) from public, anon;
grant execute on function public.concert_event_rule_violation(public.concerts) to authenticated;

create or replace function public.assert_event_bill_valid(p_event_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  concert public.concerts%rowtype;
  violation text;
begin
  for concert in
    select *
    from public.concerts
    where event_id = p_event_id
  loop
    violation := public.concert_event_rule_violation(concert);
    if violation is not null then
      raise exception '%', violation;
    end if;
  end loop;
end;
$$;

revoke execute on function public.assert_event_bill_valid(uuid) from public, anon;
grant execute on function public.assert_event_bill_valid(uuid) to authenticated;

create or replace function public.enforce_concert_event_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  violation text;
begin
  violation := public.concert_event_rule_violation(new);
  if violation is not null then
    raise exception '%', violation;
  end if;

  return new;
end;
$$;

create constraint trigger concerts_event_rules
after insert or update on public.concerts
deferrable initially deferred
for each row
execute function public.enforce_concert_event_rules();

revoke execute on function public.enforce_concert_event_rules() from public, anon, authenticated;

create or replace function public.enforce_event_bill_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.assert_event_bill_valid(new.id);
  return new;
end;
$$;

create constraint trigger events_bill_rules
after update of start_date, end_date, place, allow_place_override on public.events
deferrable initially deferred
for each row
execute function public.enforce_event_bill_rules();

revoke execute on function public.enforce_event_bill_rules() from public, anon, authenticated;

create or replace function public.enforce_event_stages_bill_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.assert_event_bill_valid(coalesce(new.event_id, old.event_id));
  return coalesce(new, old);
end;
$$;

create constraint trigger event_stages_bill_rules
after insert or update or delete on public.event_stages
deferrable initially deferred
for each row
execute function public.enforce_event_stages_bill_rules();

revoke execute on function public.enforce_event_stages_bill_rules() from public, anon, authenticated;

create or replace function public.events_cascade_inherited_place()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.allow_place_override = false and new.place is distinct from old.place then
    update public.concerts
    set place = new.place
    where event_id = new.id;
  end if;

  return new;
end;
$$;

create trigger events_cascade_inherited_place
after update of place, allow_place_override on public.events
for each row
execute function public.events_cascade_inherited_place();

revoke execute on function public.events_cascade_inherited_place() from public, anon, authenticated;

drop policy if exists "Authenticated users can insert own concerts" on public.concerts;
drop policy if exists "Authenticated users can update own concerts" on public.concerts;

create policy "Authenticated users can insert own concerts"
  on public.concerts
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.events
      where events.id = concerts.event_id
        and events.owner_id = (select auth.uid())
        and concerts.date >= events.start_date
        and concerts.date <= events.end_date
        and (
          events.allow_place_override
          or concerts.place = events.place
        )
        and (
          not exists (
            select 1
            from public.event_stages
            where event_stages.event_id = events.id
          )
          or exists (
            select 1
            from public.event_stages
            where event_stages.id = concerts.stage_id
              and event_stages.event_id = events.id
          )
        )
    )
  );

create policy "Authenticated users can update own concerts"
  on public.concerts
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1
      from public.events
      where events.id = concerts.event_id
        and events.owner_id = (select auth.uid())
        and concerts.date >= events.start_date
        and concerts.date <= events.end_date
        and (
          events.allow_place_override
          or concerts.place = events.place
        )
        and (
          not exists (
            select 1
            from public.event_stages
            where event_stages.event_id = events.id
          )
          or exists (
            select 1
            from public.event_stages
            where event_stages.id = concerts.stage_id
              and event_stages.event_id = events.id
          )
        )
    )
  );

create or replace function public.save_event_and_concert_dates(
  p_event_id uuid,
  p_start_date date,
  p_end_date date,
  p_concert_dates jsonb,
  p_name text default null,
  p_place text default null,
  p_allow_place_override boolean default null,
  p_stages jsonb default null
)
returns public.events
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_event public.events%rowtype;
  patch jsonb;
  stage_row jsonb;
  kept_stage_ids uuid[] := '{}';
  updated_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'You do not own this Event.';
  end if;

  update public.events
  set start_date = p_start_date,
      end_date = p_end_date,
      name = coalesce(p_name, name),
      place = coalesce(p_place, place),
      allow_place_override = coalesce(p_allow_place_override, allow_place_override)
  where id = p_event_id
    and owner_id = (select auth.uid())
  returning * into updated_event;

  if not found then
    raise exception 'You do not own this Event.';
  end if;

  if p_stages is not null then
    for stage_row in
      select value
      from jsonb_array_elements(p_stages)
    loop
      insert into public.event_stages (id, event_id, name)
      values (
        (stage_row->>'id')::uuid,
        p_event_id,
        trim(stage_row->>'name')
      )
      on conflict (id) do update
        set name = excluded.name
        where event_stages.event_id = p_event_id;

      kept_stage_ids := array_append(kept_stage_ids, (stage_row->>'id')::uuid);
    end loop;

    delete from public.event_stages
    where event_id = p_event_id
      and not (id = any (kept_stage_ids));
  end if;

  if p_concert_dates is not null then
    for patch in
      select value
      from jsonb_array_elements(p_concert_dates)
    loop
      update public.concerts
      set date = coalesce((patch->>'date')::date, date),
          stage_id = case
            when patch ? 'stage_id' then nullif(patch->>'stage_id', '')::uuid
            else stage_id
          end,
          place = coalesce(nullif(patch->>'place', ''), place)
      where id = (patch->>'id')::uuid
        and event_id = p_event_id
        and owner_id = (select auth.uid());

      get diagnostics updated_count = row_count;
      if updated_count <> 1 then
        raise exception 'Concert identity is invalid.';
      end if;
    end loop;
  end if;

  return updated_event;
end;
$$;

revoke execute on function public.save_event_and_concert_dates(uuid, date, date, jsonb, text, text, boolean, jsonb) from public, anon;
grant execute on function public.save_event_and_concert_dates(uuid, date, date, jsonb, text, text, boolean, jsonb) to authenticated;
