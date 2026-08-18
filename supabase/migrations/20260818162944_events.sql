-- Owner-only events. Civil Europe/Paris dates are stored as date (no timezone).

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  place text not null,
  constraint events_kind_check check (kind in ('single_night', 'festival')),
  constraint events_dates_check check (end_date >= start_date)
);

create index events_owner_id_start_date_idx
  on public.events (owner_id, start_date);

alter table public.events enable row level security;

grant select, insert, update on table public.events to authenticated;

create policy "Authenticated users can select own events"
  on public.events
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Authenticated users can insert own events"
  on public.events
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Authenticated users can update own events"
  on public.events
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
