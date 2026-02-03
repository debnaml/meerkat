# Worker Service

This workspace hosts the Node-based job runner that polls Postgres (`pending_checks` table), runs monitor checks, and writes results back to Supabase. It reuses the shared `runBaselineCheck()` helper from the web app so scheduled runs match the on-create validation path.

## Scripts

- `npm run start --workspaces workers` – processes one batch and exits (useful for cron-style triggering).
- `npm run start --workspaces workers -- --watch` – keeps polling every few seconds; ideal for local dev or a long-lived worker dyno.
- `npm run dev --workspaces workers` – starts the TS watcher via `tsx`.

Environment variables required:

```
DATABASE_URL=postgresql://...
WORKER_BATCH_SIZE=5              # optional, defaults to 5
WORKER_POLL_INTERVAL_MS=5000     # optional, defaults to 5000ms
WORKER_MAX_ATTEMPTS=5            # optional, defaults to 5
```

`DATABASE_URL` should point to the Supabase Postgres instance (service-role credentials). The worker uses row-level security–bypassing credentials, so limit network access appropriately.

## How it Works

1. Claims jobs from `public.pending_checks` with `FOR UPDATE SKIP LOCKED` to avoid duplicate work.
2. Runs `runBaselineCheck()` to fetch and normalize the monitor target.
3. Inserts a new row in `public.checks`, updates the associated monitor metadata, and removes the job.
4. On failure, increments `attempts`, records the error, and reschedules with exponential backoff (capped at 60 minutes).

The same process will later handle change detection, diff generation, and notifications once those queues are defined.

## Deploying to Fly.io

The repo includes [Dockerfile.worker](../../Dockerfile.worker) and [fly.toml](../../fly.toml) so this worker can run on a tiny Fly machine.

1. Install flyctl and log in: `brew install flyctl && fly auth login`
2. (First-time only) `fly launch --name meerkat-worker --dockerfile Dockerfile.worker --no-deploy`
3. Provide secrets: `fly secrets set DATABASE_URL="postgresql://..."`
4. Deploy: `fly deploy --dockerfile Dockerfile.worker`

Scale with `fly scale count <n>` and inspect logs via `fly logs -a meerkat-worker`. The same Dockerfile works on any other container host if you prefer Railway/Render/etc.
