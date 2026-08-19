-- Owner may move a Concert to another Event they own. Concert id and owner_id
-- stay immutable. Attendance and notes stay on concerts.id. Target Event dates,
-- Place policy, and Stage/Scene list still apply via concerts_event_rules and
-- the concerts UPDATE WITH CHECK.

create or replace function public.concerts_protect_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id then
    raise exception 'Concert identity cannot be changed';
  end if;

  if new.event_id is distinct from old.event_id then
    if not exists (
      select 1
      from public.events
      where events.id = new.event_id
        and events.owner_id = new.owner_id
    ) then
      raise exception 'You do not own this Event.';
    end if;
  end if;

  return new;
end;
$$;
