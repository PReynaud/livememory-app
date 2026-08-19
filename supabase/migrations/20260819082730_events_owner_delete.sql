-- Owner delete is required so a New night/New festival Event can be rolled back
-- if the follow-on Concert insert fails. Event-delete UI stays later.

grant delete on table public.events to authenticated;

create policy "Authenticated users can delete own events"
  on public.events
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);
