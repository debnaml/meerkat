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
- `apps/workers` — (planned) job runners for crawling + notifications
- `packages/*` — shared domain logic and UI primitives (to be added)

See [spec.md](spec.md) and [spec2.md](spec2.md) for the evolving product/engineering plan.
