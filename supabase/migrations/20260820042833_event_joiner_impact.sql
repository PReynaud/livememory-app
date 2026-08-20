-- Owner-only boolean lookups so delete/move confirms can name joiner impact
-- without exposing a roster. event_members SELECT stays own-row; these RPCs
-- return exists-only. SECURITY DEFINER is required because own-row RLS hides
-- other members from the Event owner. Callers must own the Event(s).

create or replace function public.event_has_joiners(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.events
      where events.id = p_event_id
        and events.owner_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.event_members
      where event_members.event_id = p_event_id
    );
$$;

revoke all on function public.event_has_joiners(uuid) from public;
grant execute on function public.event_has_joiners(uuid) to authenticated;

create or replace function public.concert_move_would_lose_joiners(
  p_source_event_id uuid,
  p_target_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.events as source
      join public.events as target
        on target.id = p_target_event_id
       and target.owner_id = (select auth.uid())
      where source.id = p_source_event_id
        and source.owner_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.event_members as source_member
      where source_member.event_id = p_source_event_id
        and not exists (
          select 1
          from public.event_members as target_member
          where target_member.event_id = p_target_event_id
            and target_member.user_id = source_member.user_id
        )
    );
$$;

revoke all on function public.concert_move_would_lose_joiners(uuid, uuid) from public;
grant execute on function public.concert_move_would_lose_joiners(uuid, uuid) to authenticated;
