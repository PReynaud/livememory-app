-- Event membership for join-via-URL. Owner stays on events.owner_id and is
-- never stored in event_members. Members may SELECT the Event, its Concerts,
-- and its stages. Notes stay owner-only: authenticated cannot SELECT
-- concerts.notes; owners read public.concert_notes.

create table public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  constraint event_members_event_user_key unique (event_id, user_id)
);

create index event_members_user_id_idx
  on public.event_members (user_id);

alter table public.event_members enable row level security;

grant select, insert on table public.event_members to authenticated;

create policy "Authenticated users can select own event membership"
  on public.event_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert own event membership"
  on public.event_members
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.event_members_enforce_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if new.user_id is distinct from (select auth.uid()) then
    raise exception 'Event not found';
  end if;

  select events.owner_id
    into owner
  from public.events
  where events.id = new.event_id;

  if owner is null or owner = new.user_id then
    raise exception 'Event not found';
  end if;

  return new;
end;
$$;

create trigger event_members_enforce_join
  before insert on public.event_members
  for each row
  execute function public.event_members_enforce_join();

revoke execute on function public.event_members_enforce_join() from public, anon, authenticated;

drop policy if exists "Authenticated users can select own events" on public.events;

create policy "Authenticated users can select owned or joined events"
  on public.events
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or exists (
      select 1
      from public.event_members as membership
      where membership.event_id = events.id
        and membership.user_id = (select auth.uid())
    )
  );

drop policy if exists "Authenticated users can select own concerts" on public.concerts;

create policy "Authenticated users can select concerts on visible events"
  on public.concerts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = concerts.event_id
    )
  );

revoke select on table public.concerts from authenticated;

grant select (
  id,
  event_id,
  owner_id,
  artist,
  date,
  "time",
  place,
  stage_id
) on table public.concerts to authenticated;

create or replace view public.concert_notes as
select
  concerts.id as concert_id,
  concerts.notes
from public.concerts
where concerts.owner_id = (select auth.uid());

grant select on table public.concert_notes to authenticated;
grant update (notes) on table public.concert_notes to authenticated;
revoke all on table public.concert_notes from public, anon;

drop policy if exists "Authenticated users can select stages on owned events" on public.event_stages;

create policy "Authenticated users can select stages on owned or joined events"
  on public.event_stages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events
      where events.id = event_stages.event_id
    )
  );
