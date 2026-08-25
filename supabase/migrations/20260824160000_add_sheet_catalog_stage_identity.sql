-- Add-sheet v2: Place is city; Stage/Scene is venue or stage (optional, type-to-create);
-- Concert identity includes stage_name; shared name catalog for autocomplete.

alter table public.concerts
  add column stage_name text;

grant select (stage_name) on table public.concerts to authenticated;

update public.concerts as concert
set stage_name = stage.name
from public.event_stages as stage
where stage.id = concert.stage_id;

create or replace function public.concerts_set_stage_name()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.stage_id is null then
    new.stage_name := null;
  else
    select name
      into new.stage_name
    from public.event_stages
    where id = new.stage_id;

    if new.stage_name is null then
      raise exception 'Stage or Scene must be on this Event.';
    end if;
  end if;

  return new;
end;
$$;

create trigger concerts_set_stage_name
  before insert or update of stage_id
  on public.concerts
  for each row
  execute function public.concerts_set_stage_name();

revoke execute on function public.concerts_set_stage_name() from public, anon, authenticated;

create or replace function public.event_stages_sync_concert_stage_name()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.name is distinct from old.name then
    update public.concerts
    set stage_name = new.name
    where stage_id = new.id;
  end if;

  return new;
end;
$$;

create trigger event_stages_sync_concert_stage_name
  after update of name on public.event_stages
  for each row
  execute function public.event_stages_sync_concert_stage_name();

revoke execute on function public.event_stages_sync_concert_stage_name() from public, anon, authenticated;

drop index if exists public.concerts_owner_artist_date_time_idx;

create unique index concerts_owner_artist_date_time_stage_idx
  on public.concerts (
    owner_id,
    (lower(artist)),
    date,
    "time",
    (lower(coalesce(stage_name, '')))
  )
  where "time" is not null;

create or replace function public.concert_event_rule_violation(concert public.concerts)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  ev public.events%rowtype;
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

  if concert.stage_id is not null and not exists (
    select 1
    from public.event_stages
    where id = concert.stage_id
      and event_id = ev.id
  ) then
    return 'Stage or Scene must be on this Event.';
  end if;

  return null;
end;
$$;

drop policy if exists "Authenticated users can insert own concerts" on public.concerts;
drop policy if exists "Authenticated users can update own concerts" on public.concerts;

create policy "Authenticated users can insert own concerts"
  on public.concerts
  for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and btrim(concerts.artist) <> ''
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
          concerts.stage_id is null
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
    and btrim(concerts.artist) <> ''
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
          concerts.stage_id is null
          or exists (
            select 1
            from public.event_stages
            where event_stages.id = concerts.stage_id
              and event_stages.event_id = events.id
          )
        )
    )
  );

create or replace function public.enforce_event_stages_bill_rules()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then
    if exists (
      select 1
      from public.concerts
      where event_id = old.event_id
        and stage_id = old.id
    ) then
      raise exception 'Stage or Scene must be on this Event.';
    end if;

    perform public.assert_event_bill_valid(old.event_id);
    perform public.assert_event_bill_valid(new.event_id);
  else
    perform public.assert_event_bill_valid(coalesce(new.event_id, old.event_id));
  end if;

  return coalesce(new, old);
end;
$$;

create table public.name_catalog (
  kind text not null,
  name text not null,
  name_normalized text generated always as (lower(btrim(name))) stored,
  created_at timestamptz not null default now(),
  constraint name_catalog_kind_check check (kind in ('artist', 'place', 'stage')),
  constraint name_catalog_name_not_blank check (char_length(btrim(name)) > 0),
  primary key (kind, name_normalized)
);

create index name_catalog_kind_normalized_prefix_idx
  on public.name_catalog (kind, name_normalized text_pattern_ops);

alter table public.name_catalog enable row level security;

grant select, insert on table public.name_catalog to authenticated;

create policy "Authenticated users can select name catalog"
  on public.name_catalog
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert name catalog"
  on public.name_catalog
  for insert
  to authenticated
  with check (true);

insert into public.name_catalog (kind, name)
select distinct 'artist', btrim(artist)
from public.concerts
where char_length(btrim(artist)) > 0
on conflict do nothing;

insert into public.name_catalog (kind, name)
select distinct 'place', btrim(place)
from public.events
where char_length(btrim(place)) > 0
on conflict do nothing;

insert into public.name_catalog (kind, name)
select distinct 'place', btrim(place)
from public.concerts
where char_length(btrim(place)) > 0
on conflict do nothing;

insert into public.name_catalog (kind, name)
select distinct 'stage', btrim(name)
from public.event_stages
where char_length(btrim(name)) > 0
on conflict do nothing;

create or replace function public.catalog_remember_names()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_table_name = 'concerts' then
    insert into public.name_catalog (kind, name)
    values ('artist', btrim(new.artist))
    on conflict do nothing;

    insert into public.name_catalog (kind, name)
    values ('place', btrim(new.place))
    on conflict do nothing;

    if new.stage_name is not null and char_length(btrim(new.stage_name)) > 0 then
      insert into public.name_catalog (kind, name)
      values ('stage', btrim(new.stage_name))
      on conflict do nothing;
    end if;
  elsif tg_table_name = 'events' then
    insert into public.name_catalog (kind, name)
    values ('place', btrim(new.place))
    on conflict do nothing;
  elsif tg_table_name = 'event_stages' then
    insert into public.name_catalog (kind, name)
    values ('stage', btrim(new.name))
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger concerts_catalog_remember_names
  after insert or update of artist, place, stage_name
  on public.concerts
  for each row
  execute function public.catalog_remember_names();

create trigger events_catalog_remember_names
  after insert or update of place
  on public.events
  for each row
  execute function public.catalog_remember_names();

create trigger event_stages_catalog_remember_names
  after insert or update of name
  on public.event_stages
  for each row
  execute function public.catalog_remember_names();

revoke execute on function public.catalog_remember_names() from public, anon, authenticated;
