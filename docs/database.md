# Database & Supabase Setup

This project uses Supabase (managed Postgres + auth/storage) for multi-tenant data. The SQL schema lives in `supabase/migrations` so we can apply it to Supabase Cloud or a local Postgres instance.

## Prerequisites

- Supabase account (or self-hosted Postgres instance)
- [Supabase CLI](https://supabase.com/docs/guides/cli) `>= 1.200.0`
- Access to a service-role key for local development (needed for migrations and background workers)

## Environment Variables

Duplicate `.env.example` into `.env` at the repo root and set:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=public-anon-key
SUPABASE_SERVICE_ROLE_KEY=service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
DEV_ORG_ID=<uuid-from-orgs-table>
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
```

`DATABASE_URL` is required by local scripts (Prisma, Drizzle, psql, etc.) even if the runtime uses Supabase client SDKs.

## Applying Migrations

1. Authenticate and link the Supabase project:
   ```
   supabase login
   supabase link --project-ref <your-ref>
   ```
2. Reset or migrate the linked database with our schema:
   ```
   supabase db reset --linked        # drops + recreates with all migrations
   # or
   supabase db push --linked         # applies pending migrations only
   ```

The entry migration `0001_initial_schema.sql` creates every core table (`orgs`, `users`, `plans`, `subscriptions`, `monitors`, `checks`, `changes`, `notifications`, `monitor_recipients`) plus helper functions and indexes.

## Row Level Security (RLS)

- Each org-scoped table enables RLS and uses the helper `public.current_org_id()` to scope queries. The function now reads `org_id` from either a top-level JWT claim or from `app_metadata.org_id`, mirroring what our signup route stores via Supabase Admin.
- API routes must ensure `app_metadata.org_id` stays in sync (signup sets it, and we never mutate it elsewhere) so end-user sessions automatically satisfy RLS.
- Background workers may use the service-role key, which bypasses RLS, but **must** constrain queries manually to avoid cross-tenant leakage.

## Local Development Workflow

1. Run `supabase start` if you want a local Postgres + Supabase stack. Otherwise, point `DATABASE_URL` to a remote environment.
2. Execute `supabase db reset --linked` after editing any SQL migration to keep your local database in sync.
3. Insert a development org row and capture its UUID for `DEV_ORG_ID`:
   ```
   insert into public.orgs (name) values ('Meerkat Dev Org') returning id;
   ```
4. Seed reference data (plans, demo monitors) by adding additional SQL files to `supabase/seed` (todo) or by running custom scripts.

## Next Steps

- Add dedicated migration files for future features instead of editing `0001` once merged.
- Introduce automated schema checks in CI (Supabase CLI or `migra`) to prevent drift.
- Capture shared SQL view/functions (e.g., change summaries) in new migration files when they mature.
