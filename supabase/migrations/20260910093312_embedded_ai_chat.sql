-- Embedded AI Chat keeps only encrypted provider credentials and opaque Cloud
-- Agent thread identifiers. Conversation content and prompt images are never
-- persisted by LiveMemory.
create table public.agent_connections (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  credential_ciphertext text not null,
  credential_iv text not null,
  credential_auth_tag text not null,
  agent_id text,
  health text not null default 'healthy'
    check (health in ('healthy', 'unhealthy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_connections enable row level security;

revoke all on table public.agent_connections from public, anon, authenticated;
grant select, insert, update, delete on table public.agent_connections to service_role;

create table public.agent_pending_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  connection_updated_at timestamptz not null,
  prompt text not null,
  preview text not null,
  operations jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.agent_pending_proposals enable row level security;
revoke all on table public.agent_pending_proposals from public, anon, authenticated;
grant select, insert, update, delete on table public.agent_pending_proposals to service_role;

create or replace function public.set_agent_connection_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agent_connections_updated_at
  before update on public.agent_connections
  for each row execute function public.set_agent_connection_updated_at();
