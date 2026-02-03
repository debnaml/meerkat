-- Ensure pending_checks supports ON CONFLICT (monitor_id)
create unique index if not exists pending_checks_monitor_unique
  on public.pending_checks (monitor_id);
