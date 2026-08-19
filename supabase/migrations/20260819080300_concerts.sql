-- Owner concerts on owned events. Civil Europe/Paris dates and optional clock time
-- are stored without timezone. Place is copied from the Event at insert.
-- Insert RLS also enforces the Event date range and inherited Place (AD-11).

create table public.concerts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  artist text not null,
  date date not null,
  "time" time,
  place text not null
);

create index concerts_event_id_date_idx
  on public.concerts (event_id, date);

alter table public.concerts enable row level security;

grant select, insert on table public.concerts to authenticated;

create policy "Authenticated users can select concerts on owned events"
  on public.concerts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = concerts.event_id
        and events.owner_id = (select auth.uid())
    )
  );

create policy "Authenticated users can insert concerts on owned events"
  on public.concerts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events
      where events.id = concerts.event_id
        and events.owner_id = (select auth.uid())
        and concerts.date >= events.start_date
        and concerts.date <= events.end_date
        and concerts.place = events.place
    )
  );
