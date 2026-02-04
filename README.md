# Meerkat

A ChangeTower-style SaaS for monitoring page and section changes. This repo hosts every app (web, workers, shared packages) using npm workspaces.

## Getting Started

- `npm install` — install all workspace dependencies
- `npm run dev` — start the Next.js web app in `apps/web`
- `npm run lint` — run ESLint for the web app
- `npm run test` — execute the Vitest suite (API and domain unit tests)
- `npm run build` — production build for the web app
- `npm run start` — run the built app

## Database Setup

1. Copy `.env.example` to `.env` and fill in Supabase + Postgres credentials (including `DEV_ORG_ID`, which should be the UUID of a row in `orgs`). Make sure both `SUPABASE_*` and `NEXT_PUBLIC_SUPABASE_*` values are set so auth works on the client and server.
2. Install the Supabase CLI and link your project: `supabase login` then `supabase link --project-ref <ref>`.
3. Apply the schema: `supabase db reset --linked` (or `db push`). This runs the SQL in `supabase/migrations/0001_initial_schema.sql`.
4. See [docs/database.md](docs/database.md) for details on RLS expectations and local workflows.

## Structure

- `apps/web` — Next.js App Router UI (Tailwind, TypeScript)
- `apps/workers` — Node-based queue processor that runs scheduled checks
- `supabase/` — SQL migrations plus server-side functions (e.g., `enqueue_due_checks`)
- `docs/` — architecture notes such as [docs/scheduling.md](docs/scheduling.md) and [docs/change-events.md](docs/change-events.md)

See [spec.md](spec.md) and [spec2.md](spec2.md) for the evolving product/engineering plan.

## How It Works (Illustrated)

```mermaid
flowchart LR
   subgraph User Experience
      U[User]
      UI[Next.js Dashboard]
      U -->|auth| UI
      UI -->|create/adjust monitors| DB[(Supabase Postgres)]
   end

   subgraph Scheduling
      Cron[Supabase pg_cron]
      Queue[(pending_checks)]
      Cron -->|select due monitors| Queue
   end

   subgraph Worker
      Worker[Fly.io Worker]
      Check[runBaselineCheck()]
      Snap[monitor_snapshots (premium)]
      Events[change_events]
      Worker --> Check --> DB
      Worker --> Snap
      Snap --> Events
   end

   Queue -->|jobs| Worker
   Events --> UI
   UI -->|change feed| U
   UI -->|needs attention| U
```

```
Users → Next.js dashboard ─┬─ create/adjust monitors (Supabase auth + RLS)
                                        │
                                        └─ writes monitor metadata (interval, selector, tier) to Postgres

Supabase Cron (pg_cron) → every minute calls `enqueue_due_checks()`
                                     └─ moves due monitors into `pending_checks`

Fly.io worker (apps/workers) → polls `pending_checks`
   ├─ runs `runBaselineCheck()` (HTTP fetch + normalization)
   ├─ records `checks` rows + updates monitor status/next run
   └─ for higher tiers (Week 3+):
          ├─ stores HTML/text snapshots (`monitor_snapshots`)
          └─ creates `change_events` (+ optional block metadata) when diffs exist

Dashboard UI
   ├─ Shows Active Monitors table (status lozenges, intervals, sensitivity)
   ├─ “Needs attention” list highlights failing/paused/stale monitors
   ├─ “Recent changes” feed reads from `change_events`
   └─ Quick Add modal lets users spin up new monitors without leaving the page

Notification layer (Week 4+) will subscribe to `change_events` so alerts go out within minutes of a detected change.
```

## Scheduling & Worker Deployment

The monitoring loop is intentionally lightweight—Postgres + Supabase Cron keep the schedule, and `apps/workers` does the actual fetches.

1. **Deploy the cron function**
   - `supabase db push --file supabase/functions/enqueue_due_checks.sql`
   - This SQL relies on the `pending_checks_monitor_unique` index added in `supabase/migrations/0004_pending_checks_unique.sql`.
2. **Create the cron job**
   - Supabase Studio → Integrations → **Cron** → Enable `pg_cron`
   - “New Cron Job” → SQL snippet `select public.enqueue_due_checks();` with schedule `* * * * *`
3. **Run the worker**
   - Locally: `DATABASE_URL="postgresql://..." npm run start --workspace workers -- --watch`
   - Hosted: use the provided [Dockerfile.worker](Dockerfile.worker) with Fly.io (`fly launch --dockerfile Dockerfile.worker`, `fly secrets set DATABASE_URL=...`, `fly deploy`)

Full queue behavior, failure handling, and hosting options are documented in [docs/scheduling.md](docs/scheduling.md).
