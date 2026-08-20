-- Joiners may leave: delete their own event_members row. Attendance on that
-- Event's Concerts is removed in the same statement so it cannot orphan after
-- membership (and Concert visibility) is gone.

grant delete on table public.event_members to authenticated;

create policy "Authenticated users can delete own event membership"
  on public.event_members
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.event_members_leave_attendance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.user_id is distinct from (select auth.uid()) then
    raise exception 'Event not found';
  end if;

  delete from public.attendance
  where attendance.user_id = old.user_id
    and attendance.concert_id in (
      select concerts.id
      from public.concerts
      where concerts.event_id = old.event_id
    );

  return old;
end;
$$;

create trigger event_members_leave_attendance
  before delete on public.event_members
  for each row
  execute function public.event_members_leave_attendance();

revoke execute on function public.event_members_leave_attendance() from public, anon, authenticated;
