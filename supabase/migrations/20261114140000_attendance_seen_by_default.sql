-- Past concerts are seen by default. A stored `missed` row is the only way to
-- say a past concert was not seen. Unset stays "no row": a past concert on an
-- Event the User owns or joined reads as attended, an upcoming one stays unset.

alter table public.attendance
  drop constraint attendance_status_check;

alter table public.attendance
  add constraint attendance_status_check check (status in ('going', 'attended', 'missed'));

create or replace function public.attendance_enforce_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  concert_date date;
  concert_time time;
  is_past boolean;
begin
  select date, "time"
    into concert_date, concert_time
  from public.concerts
  where id = new.concert_id;

  if not found then
    raise exception 'Concert was not found';
  end if;

  if tg_op = 'UPDATE' and old.status = 'attended' and new.status = 'going' then
    raise exception using
      errcode = 'P0001',
      message = 'attended_to_going',
      detail = 'Cannot change attended to going.';
  end if;

  is_past := public.concert_is_past(concert_date, concert_time);

  if new.status = 'going' and is_past then
    new.status := 'attended';
  end if;

  if new.status = 'attended' and not is_past then
    raise exception using
      errcode = 'P0001',
      message = 'future_attended',
      detail = 'Cannot mark a future concert as attended.';
  end if;

  if new.status = 'missed' and not is_past then
    raise exception using
      errcode = 'P0001',
      message = 'future_missed',
      detail = 'Cannot mark a future concert as not seen.';
  end if;

  return new;
end;
$$;

revoke execute on function public.attendance_enforce_status() from public, anon, authenticated;

-- Invoker view: concerts RLS limits rows to Events the caller owns or joined.
-- Synthesized rows (past, no stored row) reuse the concert id as their id.
create or replace view public.attendance_effective
with (security_invoker = true) as
select
  coalesce(attendance.id, concerts.id) as id,
  coalesce(attendance.user_id, (select auth.uid())) as user_id,
  concerts.id as concert_id,
  case
    when attendance.status = 'missed' then 'missed'
    when public.concert_is_past(concerts.date, concerts."time") then 'attended'
    else attendance.status
  end as status
from public.concerts
left join public.attendance
  on attendance.concert_id = concerts.id
  and attendance.user_id = (select auth.uid())
where attendance.id is not null
  or public.concert_is_past(concerts.date, concerts."time");

grant select on table public.attendance_effective to authenticated;

-- Definer view: filter to Events the profile owns or joined explicitly.
create or replace view public.shared_list_concerts
with (security_invoker = false)
as
select
  profiles.username,
  lower(profiles.username) as username_key,
  events.id as event_id,
  events.name as event_name,
  events.kind as event_kind,
  events.start_date,
  events.end_date,
  events.place as event_place,
  concerts.id as concert_id,
  concerts.artist,
  concerts.date as concert_date,
  concerts."time" as concert_time,
  concerts.place as concert_place,
  concerts.stage_id,
  event_stages.name as stage_name
from public.profiles
join public.events
  on events.owner_id = profiles.id
  or exists (
    select 1
    from public.event_members
    where event_members.event_id = events.id
      and event_members.user_id = profiles.id
  )
join public.concerts
  on concerts.event_id = events.id
left join public.attendance
  on attendance.concert_id = concerts.id
  and attendance.user_id = profiles.id
left join public.event_stages
  on event_stages.id = concerts.stage_id
where profiles.shared_list_enabled
  and (
    case
      when attendance.status = 'missed' then 'missed'
      when public.concert_is_past(concerts.date, concerts."time") then 'attended'
      else attendance.status
    end
  ) in ('going', 'attended');

revoke all on table public.shared_list_concerts from public, anon, authenticated;
