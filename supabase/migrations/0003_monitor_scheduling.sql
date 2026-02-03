-- 0003_monitor_scheduling.sql
-- Add scheduling metadata for monitors and introduce pending_checks queue table.

alter table public.monitors
  add column next_check_at timestamptz,
  add column last_check_id uuid references public.checks(id);

alter table public.monitors
  alter column last_status set default 'pending';

update public.monitors set last_status = coalesce(last_status, 'pending');

alter table public.checks
  add column html_bytes integer,
  add column final_url text;

create table public.pending_checks (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  scheduled_for timestamptz not null,
  attempts integer not null default 0,
  locked_at timestamptz,
  lock_id uuid,
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_pending_checks_ready on public.pending_checks (scheduled_for);
create index idx_pending_checks_monitor on public.pending_checks (monitor_id);

alter table public.pending_checks enable row level security;

create policy pending_checks_same_org on public.pending_checks
for all
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());
