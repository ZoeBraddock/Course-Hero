Your goal is to run the Course Hero frontend locally and view it in a browser via the Playwright MCP, to confirm the dev server is serving the site.

Do the following:

1. **Ensure local Supabase is running.** From the repo root run `supabase status`. If it isn't started, run `supabase start`. Grab the Project URL (e.g. `http://127.0.0.1:54321`) and the publishable/anon key from the output.

2. **Ensure `course-hero/.env.local` exists** (gitignored). If missing, create it pointing at the running Supabase, because `course-hero/lib/supabase.ts` reads these at module load and `app/page.tsx` queries Supabase at render time (missing env vars → the page throws):
   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL from supabase status>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from supabase status>
   ```

3. **Install deps if needed.** If `course-hero/node_modules` is missing, run `npm install` from inside `course-hero/`.

4. **Start the dev server** in the background from `course-hero/`: `npm run dev` (Next.js 16, serves `http://localhost:3000`). Wait until the output reports `Ready`.

5. **Open it in Playwright.** Use the Playwright MCP to `browser_navigate` to `http://localhost:3000`, then `browser_snapshot` and/or `browser_take_screenshot` to view the rendered homepage (the "Course Hero" hero + "Available Courses" section).
   - If Playwright reports Chrome isn't installed, run `npx playwright install chrome` once, then retry.

6. **Report** whether the page rendered without an error banner. An empty "Available Courses" list is fine (just means no seed data) — it still confirms the server works.

## Cleanup

After viewing the site (or whenever the user asks to tear down the local environment):

7. **Stop the dev server.** Kill the background `npm run dev` process, e.g. `pkill -f "next dev"`. Confirm port 3000 is free (`ss -ltn | grep ':3000'` returns nothing).

8. **Stop local Supabase.** From the repo root run `supabase stop`. Local data is preserved in the docker volume, so a later `supabase start` restores it.
