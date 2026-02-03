-- 0001_initial_schema.sql
-- Foundational schema for Meerkat page-monitoring SaaS

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims.org_id', true), '')::uuid;
$$;

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.plans (
  id text primary key,
  max_monitors integer not null check (max_monitors > 0),
  min_interval_minutes integer not null check (min_interval_minutes > 0),
  retention_days integer not null check (retention_days > 0),
  price_id_stripe text,
  created_at timestamptz not null default now()
);

insert into public.plans (id, max_monitors, min_interval_minutes, retention_days, price_id_stripe)
values
  ('starter', 50, 60, 30, null),
  ('pro', 250, 15, 90, null)
on conflict (id) do nothing;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email citext not null,
  auth_user_id uuid unique,
  password_hash text,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  plan_id text not null references public.plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive' check (status in ('active', 'past_due', 'trialing', 'canceled', 'inactive')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.monitors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  url text not null,
  type text not null check (type in ('page', 'section', 'visual')),
  selector_css text,
  interval_minutes integer not null check (interval_minutes > 0),
  sensitivity text not null default 'normal' check (sensitivity in ('strict', 'normal', 'relaxed')),
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_change_at timestamptz,
  last_status text,
  created_at timestamptz not null default now()
);

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok', 'timeout', 'http_error', 'blocked', 'parse_error')),
  http_status integer,
  fetch_mode text not null default 'http' check (fetch_mode in ('http', 'playwright')),
  content_hash text,
  extracted_text_bytes integer,
  html_snapshot_path text,
  screenshot_path text,
  error_message text
);

create table public.changes (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  check_id_new uuid not null references public.checks(id) on delete cascade,
  check_id_old uuid references public.checks(id) on delete set null,
  created_at timestamptz not null default now(),
  diff_path text,
  summary text,
  severity text check (severity in ('low', 'medium', 'high'))
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  change_id uuid not null references public.changes(id) on delete cascade,
  channel text not null check (channel in ('email', 'slack', 'webhook')),
  target text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text
);

create table public.monitor_recipients (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.monitors(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (monitor_id, email)
);

create index idx_monitors_org_enabled on public.monitors(org_id, enabled);
create index idx_checks_monitor_started on public.checks(monitor_id, started_at desc);
create index idx_changes_monitor_created on public.changes(monitor_id, created_at desc);
create index idx_notifications_change on public.notifications(change_id);

alter table public.orgs enable row level security;
alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.monitors enable row level security;
alter table public.checks enable row level security;
alter table public.changes enable row level security;
alter table public.notifications enable row level security;
alter table public.monitor_recipients enable row level security;

create policy orgs_self_access on public.orgs
for select
using (id = public.current_org_id());

create policy users_same_org on public.users
for all
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy subscriptions_same_org on public.subscriptions
for all
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy monitors_same_org on public.monitors
for all
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy checks_same_org on public.checks
for all
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy changes_same_org on public.changes
for all
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy notifications_same_org on public.notifications
for all
using (org_id = public.current_org_id())
with check (org_id = public.current_org_id());

create policy recipients_same_org on public.monitor_recipients
for all
using (exists (
  select 1
  from public.monitors m
  where m.id = monitor_recipients.monitor_id
  and m.org_id = public.current_org_id()
))
with check (exists (
  select 1
  from public.monitors m
  where m.id = monitor_recipients.monitor_id
  and m.org_id = public.current_org_id()
));
