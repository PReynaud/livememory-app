-- Owner notes and owner edit/delete on concerts.
-- Notes stay Event-owner-only: concert SELECT/UPDATE RLS is owner_id = auth.uid().
-- Do not expose notes on a later member SELECT. Attendance follows concerts.id
-- ON DELETE CASCADE (attendance migration). Deleting a Concert must not delete
-- the Event. concerts.event_id stays NOT NULL.

alter table public.concerts
  add column notes text;

grant delete on table public.concerts to authenticated;

drop trigger if exists concerts_attach_time_only on public.concerts;
drop function if exists public.concerts_attach_time_only();

drop policy if exists "Authenticated users can update own concert time" on public.concerts;

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
        and concerts.place = events.place
    )
  );

create policy "Authenticated users can delete own concerts"
  on public.concerts
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create or replace function public.concerts_protect_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.event_id is distinct from old.event_id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Concert identity cannot be changed';
  end if;

  return new;
end;
$$;

create trigger concerts_protect_identity
  before update on public.concerts
  for each row
  execute function public.concerts_protect_identity();

revoke execute on function public.concerts_protect_identity() from public, anon, authenticated;
