-- Copy owner_id onto concerts so timed identity is unique per owner.
-- Partial unique index: NULL time is not equal, so untimed duplicates stay a domain choice.

alter table public.concerts
  add column owner_id uuid references auth.users (id) on delete cascade;

update public.concerts as concert
set owner_id = event.owner_id
from public.events as event
where event.id = concert.event_id;

alter table public.concerts
  alter column owner_id set not null;

alter table public.concerts
  alter column owner_id set default auth.uid();

create or replace function public.set_concert_owner_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select owner_id
    into new.owner_id
  from public.events
  where id = new.event_id;

  if new.owner_id is null then
    raise exception 'Concert Event was not found';
  end if;

  return new;
end;
$$;

create trigger concerts_set_owner_id
  before insert on public.concerts
  for each row
  execute function public.set_concert_owner_id();

revoke execute on function public.set_concert_owner_id() from public, anon, authenticated;

create unique index concerts_owner_artist_date_time_idx
  on public.concerts (owner_id, (lower(artist)), date, "time")
  where "time" is not null;

create index concerts_owner_id_date_idx
  on public.concerts (owner_id, date);

grant update on table public.concerts to authenticated;

drop policy "Authenticated users can select concerts on owned events" on public.concerts;
drop policy "Authenticated users can insert concerts on owned events" on public.concerts;

create policy "Authenticated users can select own concerts"
  on public.concerts
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

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
    )
  );

create policy "Authenticated users can update own concert time"
  on public.concerts
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create or replace function public.concerts_attach_time_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.event_id is distinct from old.event_id
     or new.owner_id is distinct from old.owner_id
     or new.artist is distinct from old.artist
     or new.date is distinct from old.date
     or new.place is distinct from old.place then
    raise exception 'Only concert time can be updated';
  end if;

  if old."time" is not null and new."time" is distinct from old."time" then
    raise exception 'Only concert time can be updated';
  end if;

  return new;
end;
$$;

create trigger concerts_attach_time_only
  before update on public.concerts
  for each row
  execute function public.concerts_attach_time_only();

revoke execute on function public.concerts_attach_time_only() from public, anon, authenticated;
