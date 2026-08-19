-- Per-user Attendance on a Concert. Unset is no row. Effective status is a
-- security_invoker view: stored going that is past reads as attended.

create or replace function public.concert_is_past(p_date date, p_time time)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_time is null then
      (timezone('Europe/Paris', now()))::date > p_date
    else
      timezone('Europe/Paris', now()) > (p_date + p_time)
  end;
$$;

revoke execute on function public.concert_is_past(date, time) from public, anon;
grant execute on function public.concert_is_past(date, time) to authenticated;

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  concert_id uuid not null references public.concerts (id) on delete cascade,
  status text not null,
  constraint attendance_status_check check (status in ('going', 'attended')),
  constraint attendance_user_concert_key unique (user_id, concert_id)
);

create index attendance_concert_id_idx
  on public.attendance (concert_id);

alter table public.attendance enable row level security;

grant select, insert, update, delete on table public.attendance to authenticated;

create policy "Authenticated users can select own attendance"
  on public.attendance
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.concerts
      where concerts.id = attendance.concert_id
    )
  );

create policy "Authenticated users can insert own attendance"
  on public.attendance
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.concerts
      where concerts.id = attendance.concert_id
    )
  );

create policy "Authenticated users can update own attendance"
  on public.attendance
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.concerts
      where concerts.id = attendance.concert_id
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.concerts
      where concerts.id = attendance.concert_id
    )
  );

create policy "Authenticated users can delete own attendance"
  on public.attendance
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.concerts
      where concerts.id = attendance.concert_id
    )
  );

create or replace function public.attendance_enforce_status()
returns trigger
language plpgsql
set search_path = public
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

  return new;
end;
$$;

create trigger attendance_enforce_status
  before insert or update on public.attendance
  for each row
  execute function public.attendance_enforce_status();

revoke execute on function public.attendance_enforce_status() from public, anon, authenticated;

create view public.attendance_effective
with (security_invoker = true) as
select
  attendance.id,
  attendance.user_id,
  attendance.concert_id,
  case
    when attendance.status = 'going'
      and public.concert_is_past(concerts.date, concerts."time")
      then 'attended'
    else attendance.status
  end as status
from public.attendance
join public.concerts on concerts.id = attendance.concert_id;

grant select on table public.attendance_effective to authenticated;
