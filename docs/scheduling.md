# Monitor Scheduling & Queue Strategy

This document captures the lightweight scheduling approach we will implement before deciding whether to add Redis/BullMQ or other infrastructure. The goal is to keep Supabase/ Postgres as the single source of truth while maintaining a clean seam to swap in a different queue later.

## Overview

1. **Monitors table metadata** – Each monitor stores `next_check_at`, `interval_minutes`, `last_check_id`, and `last_status`. Whenever we run a check we update these columns so the database knows when the next run is due.
2. **`pending_checks` table** – A Postgres queue that stores one row per scheduled job. Columns include `monitor_id`, `org_id`, `scheduled_for`, `attempts`, `locked_at`, and `lock_id`. Jobs stay in this table until a worker finishes them or marks them failed.
3. **Supabase Cron (every minute)** – Runs a SQL function that finds due monitors and inserts rows into `pending_checks` while bumping `next_check_at += interval`. Cron executions are free on Supabase and live entirely inside the database.
4. **Worker process** – A Node script (planned under `apps/worker`) that polls `pending_checks` using `FOR UPDATE SKIP LOCKED`, processes the job with `runBaselineCheck()`, writes to `checks`, updates the monitor, and removes the row (or reschedules on failure). The worker uses the service-role key so it can bypass RLS safely.
   declare

## Supabase Cron Function

The function lives at `supabase/functions/enqueue_due_checks.sql`. Deploy it with `supabase db push --file supabase/functions/enqueue_due_checks.sql` (or `supabase db execute < file`). The `pending_checks_monitor_unique` index from `supabase/migrations/0004_pending_checks_unique.sql` must exist so the `on conflict` clause works.

```sql
create or replace function public.enqueue_due_checks(max_jobs integer default 200)
returns integer
language plpgsql
as $$
declare
  inserted_count integer;
begin
  with due as (
    select id, org_id, interval_minutes
    from public.monitors
    where enabled = true
      and coalesce(next_check_at, now()) <= now()
    order by next_check_at nulls first
    limit max_jobs
    for update skip locked
  ), inserted as (
    insert into public.pending_checks (monitor_id, org_id, scheduled_for)
    select id, org_id, now()
    from due
    on conflict (monitor_id) do nothing
    returning monitor_id
  ), bumped as (
    update public.monitors m
      set next_check_at = greatest(coalesce(m.next_check_at, now()), now()) + (m.interval_minutes || ' minutes')::interval
    from due
    where m.id = due.id
    returning m.id
  )
  select count(*)
  into inserted_count
  from inserted;

  return coalesce(inserted_count, 0);
end;
$$;
```

Schedule it in Supabase Studio → **Integrations → Cron**:

1. Enable the pg_cron integration if it isn’t already active.
2. Click “New Cron Job”, choose **SQL snippet**, and paste `select public.enqueue_due_checks();`
3. Set the cron expression to `* * * * *` so it runs every minute.

CLI alternative (once pg_cron is enabled):

```bash
supabase db remote commit \
  --name enqueue-monitor-checks \
  --schedule "* * * * *" \
  --sql "select public.enqueue_due_checks();"
```

## Worker Flow

1. Poll for jobs: `select * from pending_checks where scheduled_for <= now() and locked_at is null order by scheduled_for limit N for update skip locked;`
2. Mark as locked: set `locked_at = now(), lock_id = gen_random_uuid()` to prevent other workers from touching it.
3. Run `runBaselineCheck()` with the monitor’s URL/mode/selector and capture metrics.
4. Insert a new `checks` row, update the monitor (`last_status`, `last_checked_at`, `last_success_at`, `last_check_id`, `next_check_at`)
5. Delete the `pending_checks` row. On failure, increment `attempts`, set `error_message`, and schedule retry (e.g., `scheduled_for = now() + interval '5 minutes'`) up to a max attempt count.

## Scaling & Swap Path

- Because everything is orchestrated in SQL, we can scale horizontally by running multiple worker instances; `FOR UPDATE SKIP LOCKED` ensures each job runs once.
- If/when we outgrow Postgres for queuing, the worker already isolates “job fetch” logic. Replacing the `pending_checks` reader with BullMQ/SQS/etc. won’t change the normalization/diff code.
- Supabase cron remains useful even with an external queue: it can still mark `next_check_at` and push jobs to the new backend via HTTP functions if needed.

## Operational Notes

- Monitor creation already seeds `next_check_at` based on the baseline. The cron function simply keeps pushing the schedule forward.
- Workers must run with the Supabase service-role key and manually scope queries by `org_id` where appropriate.
- Add metrics/logging (e.g., console output or a lightweight APM) in the worker so we can monitor stuck jobs.

## Worker Hosting Options

| Host                          | Est. cost               | Pros                                          | Considerations                         |
| ----------------------------- | ----------------------- | --------------------------------------------- | -------------------------------------- |
| Fly.io shared-cpu-1x          | ~$5/mo                  | Simple scaling, health checks, global regions | Needs Dockerfile, keep instance awake  |
| Railway                       | Free dev tier, then ~$5 | Git integration, ephemeral previews           | Sleeps on inactivity unless paid       |
| Render background worker      | ~$7/mo                  | Auto-redeploy, metrics/logs built in          | Slightly higher floor cost             |
| Supabase Edge Functions       | $0                      | Already provisioned in project                | Too short-lived for continuous polling |
| Self-hosted VM (DO/Lightsail) | $5/mo                   | Full control, predictable cost                | Manual updates/monitoring              |

Pick the host that matches budget + ops comfort. Worker only needs `DATABASE_URL`, so even tiny instances work. Use `npm run start --workspace workers` for 24/7 polling or hook that command to an external scheduler.

Next actions: keep `enqueue_due_checks()` wired to cron, provision one worker instance (start with Fly.io or Railway), and add a smoke test monitor to verify the queue drains end-to-end.
