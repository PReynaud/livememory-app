-- Public Shared List concerts: enabled profiles, that User's effective
-- going/attended only. Lookup by username so v1 has no concert directory.
-- Notes, unset Attendance, and Events with no visible Concerts stay out.

create view public.shared_list_concerts
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
join public.attendance
  on attendance.user_id = profiles.id
join public.concerts
  on concerts.id = attendance.concert_id
join public.events
  on events.id = concerts.event_id
left join public.event_stages
  on event_stages.id = concerts.stage_id
where profiles.shared_list_enabled
  and (
    case
      when attendance.status = 'going'
        and public.concert_is_past(concerts.date, concerts."time")
        then 'attended'
      else attendance.status
    end
  ) in ('going', 'attended');

revoke all on table public.shared_list_concerts from public, anon, authenticated;

create or replace function public.get_shared_list_concerts(requested text)
returns table (
  event_id uuid,
  event_name text,
  event_kind text,
  start_date date,
  end_date date,
  event_place text,
  concert_id uuid,
  artist text,
  concert_date date,
  concert_time time,
  concert_place text,
  stage_id uuid,
  stage_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    shared_list_concerts.event_id,
    shared_list_concerts.event_name,
    shared_list_concerts.event_kind,
    shared_list_concerts.start_date,
    shared_list_concerts.end_date,
    shared_list_concerts.event_place,
    shared_list_concerts.concert_id,
    shared_list_concerts.artist,
    shared_list_concerts.concert_date,
    shared_list_concerts.concert_time,
    shared_list_concerts.concert_place,
    shared_list_concerts.stage_id,
    shared_list_concerts.stage_name
  from public.shared_list_concerts
  where shared_list_concerts.username_key = lower(btrim(requested))
  order by
    shared_list_concerts.start_date,
    shared_list_concerts.event_name,
    shared_list_concerts.concert_date,
    shared_list_concerts.artist;
$$;

revoke all on function public.get_shared_list_concerts(text) from public;
grant execute on function public.get_shared_list_concerts(text) to anon, authenticated;
