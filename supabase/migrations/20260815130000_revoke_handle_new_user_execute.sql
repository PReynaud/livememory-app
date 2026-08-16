-- Trigger functions must not be callable via PostgREST RPC.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
