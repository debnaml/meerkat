-- 0005_change_events.sql
-- Snapshot + change event storage for Week 3 roadmap

alter table public.orgs
  add column if not exists plan_features jsonb not null default '{}'::jsonb;

create table public.monitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  check_id uuid not null references public.checks(id) on delete cascade,
  tier text,
  content_hash text,
  html_path text,
  text_normalized text,
  blocks_json jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (check_id)
);

create index idx_monitor_snapshots_monitor_created on public.monitor_snapshots(monitor_id, created_at desc);
create index idx_monitor_snapshots_hash on public.monitor_snapshots(content_hash);
create index idx_monitor_snapshots_expiration on public.monitor_snapshots(expires_at) where expires_at is not null;

create table public.change_events (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  prev_snapshot_id uuid references public.monitor_snapshots(id) on delete set null,
  next_snapshot_id uuid not null references public.monitor_snapshots(id) on delete cascade,
  change_type text check (change_type in ('content', 'blocked', 'selector_missing', 'error', 'other')),
  severity text check (severity in ('low', 'medium', 'high')),
  summary text,
  diff_blob jsonb,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_change_events_monitor_created on public.change_events(monitor_id, created_at desc);
create index idx_change_events_unnotified on public.change_events(created_at) where notified_at is null;

create table public.change_blocks (
  id uuid primary key default gen_random_uuid(),
  change_event_id uuid not null references public.change_events(id) on delete cascade,
  block_key text,
  action text check (action in ('added', 'removed', 'modified')),
  title text,
  text_excerpt text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_change_blocks_event on public.change_blocks(change_event_id);

alter table public.monitor_snapshots enable row level security;
alter table public.change_events enable row level security;
alter table public.change_blocks enable row level security;

create policy monitor_snapshots_same_org on public.monitor_snapshots
for all
using (
  exists (
    select 1
    from public.monitors m
    where m.id = monitor_snapshots.monitor_id
      and m.org_id = public.current_org_id()
  )
)
with check (
  exists (
    select 1
    from public.monitors m
    where m.id = monitor_snapshots.monitor_id
      and m.org_id = public.current_org_id()
  )
);

create policy change_events_same_org on public.change_events
for all
using (
  exists (
    select 1
    from public.monitors m
    where m.id = change_events.monitor_id
      and m.org_id = public.current_org_id()
  )
)
with check (
  exists (
    select 1
    from public.monitors m
    where m.id = change_events.monitor_id
      and m.org_id = public.current_org_id()
  )
);

create policy change_blocks_same_org on public.change_blocks
for all
using (
  exists (
    select 1
    from public.change_events ce
    join public.monitors m on m.id = ce.monitor_id
    where ce.id = change_blocks.change_event_id
      and m.org_id = public.current_org_id()
  )
)
with check (
  exists (
    select 1
    from public.change_events ce
    join public.monitors m on m.id = ce.monitor_id
    where ce.id = change_blocks.change_event_id
      and m.org_id = public.current_org_id()
  )
);
