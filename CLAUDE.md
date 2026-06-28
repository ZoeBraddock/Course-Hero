# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo structure

```
/frontend/   — Next.js 16 (App Router) frontend
/supabase/   — Supabase migrations and config
/shopify/    — Shopify integration (separate Next.js-like app)
```

## Commands

All frontend commands run from `/frontend/`:

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run lint     # ESLint
```

SQL linting (run from repo root or `/supabase/`):

```bash
squawk migrations/*.sql   # catch dangerous migration patterns
sqlfluff lint .           # check PostgreSQL syntax
```

Pre-commit hooks run lint automatically. They require `pre-commit` installed via `pipx` (see README.md for setup).

## Architecture

**Frontend** (`/frontend/`) is Next.js 16 App Router with Tailwind CSS v4. All pages are under `app/`. There is no `src/` directory.

**Auth pattern**: every protected page is a `'use client'` component that calls `supabase.auth.getUser()` inside a `useEffect`, and redirects to `/login` if no session. There is no middleware-based auth.

**Supabase clients** — two exist, do not mix them up:
- `lib/supabase.ts` — browser client using `NEXT_PUBLIC_*` env vars; use in client components
- `lib/supabase-server.ts` — service-role admin client that bypasses RLS; use **only** in API routes (`app/api/`)

**Pages:**
- `/` — course catalogue with filter/sort
- `/my-horses` — horse CRUD with photo display
- `/my-courses` — enrolled courses
- `/course/[id]` — course detail
- `/course/[id]/instance/[instanceId]` — course instance detail
- `/create-course`, `/account`, `/login`, `/signup`, `/enrolment-success`

**API routes** (`app/api/`):
- `POST /api/checkout` — creates a Stripe checkout session (NZD currency)
- `POST /api/webhooks/stripe` — processes Stripe webhook events, sends confirmation emails via Resend

**Database** (Supabase with RLS on all tables):
- `profiles` — one row per auth user, created automatically by trigger on `auth.users` insert
- `course`, `course_instance`, `profile_course`, `orders` — course management
- `horse` — horse records with `owner_id` FK to `profiles`, includes `photo_url`
- Storage bucket `avatars` for profile pictures

**Migrations** live in `/supabase/migrations/`. Test locally with the Supabase CLI before pushing. The `course creator` subdirectory in migrations is a directory, not a SQL file.

## Environment variables

Frontend needs these in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_BASE_URL`
- Resend API key (check webhook route for the exact name)
