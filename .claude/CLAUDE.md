# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Repository layout

This is a monorepo-style repo with two independent halves that share a Supabase backend:

- `course-hero/` — the Next.js 16 / React 19 frontend (App Router, Tailwind CSS v4). All `npm` commands run from **inside this directory**, not the repo root.
- `supabase/` — the database: local Supabase config (`config.toml`) and SQL migrations in `supabase/migrations/`. Linting/migration tooling runs from the **repo root**.

## Commands

Frontend (run from `course-hero/`):

```bash
npm run dev      # start Next.js dev server on http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # ESLint (eslint-config-next)
```

Database / migrations (run from repo root):

```bash
supabase start                 # spin up local Postgres + Studio (Studio on :54323, API on :54321, db on :54322)
supabase db reset              # re-run all migrations + seed against the local db
sqlfluff lint .                # postgres syntax lint (dialect set in .sqlfluff)
squawk supabase/migrations/*.sql   # flag dangerous migrations
```

There is **no test suite**. Validation is: lint + running migrations locally before pushing.

## Pre-commit hooks

`.pre-commit-config.yaml` runs `sqlfluff-lint`, `sqlfluff-fix`, and `squawk` (the latter only on `migrations/*.sql`) on commit. Install once with `pipx install pre-commit && pre-commit install`. A commit touching SQL will fail if it doesn't pass these.

## Architecture

**Data flow.** The frontend talks to Supabase directly from React Server Components — there is no separate API layer. `course-hero/lib/supabase.ts` creates a single browser/anon client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (set these in `course-hero/.env*`, which is gitignored). Server components like `app/page.tsx` call `supabase.from('...').select(...)` and render the result. Because reads use the anon key, any table the UI reads needs RLS configured to allow `anon` SELECT.

**Database model.** The schema evolves across ordered migrations — read them in filename order to understand current state, since later migrations rewrite earlier tables:
- `20260518000000_initial_schema.sql` defines the original model: separate `student` / `instructor` profile tables, `course`, join tables `student_course` / `instructor_course`, and `orders`. RLS is enabled on everything.
- `20260518000001_user_auth.sql` **replaces** that model: it drops `student`, `instructor`, and the join tables, and introduces a unified `profiles` table (keyed off `auth.users`, with an `instructor` boolean) plus a `profile_course` join table. It adds the `handle_new_user()` trigger that auto-creates a `profiles` row on signup, sets up RLS policies, and creates an `avatars` storage bucket.

**Known schema drift (important).** The frontend and seed data are out of sync with the migrations. `app/page.tsx` and the seed file `supabase/migrations/course creator` reference a `course.name` column that does not exist in the schema (the schema has `title`, `description`, `primary_instructor`, `price`). Note also that `course creator` is a seed/insert file sitting in the migrations folder but is **not** a real migration (no timestamp prefix) — `config.toml` expects seeds in `supabase/seed.sql`. Expect to reconcile these when wiring up real course display.

## Note on Next.js version

Per `AGENTS.md`: this is Next.js 16, which has breaking changes from older versions. Consult `course-hero/node_modules/next/dist/docs/` before writing framework code rather than relying on prior Next.js knowledge.
