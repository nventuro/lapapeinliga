# La Papeinliga

Soccer group organizer -- matchday management, team sorting, stats, and media gallery backed by Supabase.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Supabase (Postgres + admin auth via Google OAuth + Edge Functions) -- migrations in `supabase/migrations/`
- Cloudflare R2 (media storage, presigned uploads via Supabase Edge Functions)
- GitHub Pages (auto-deploy via `.github/workflows/deploy.yml`)

## Conventions

- **Code language**: all code, comments, variable names, types, and file names in English
- **UI language**: all user-facing text in Argentinian Spanish (voseo, local expressions)
- **Styling**: Tailwind utility classes exclusively -- no CSS modules or styled-components. Never use hardcoded Tailwind color scales (e.g. `red-400`, `amber-600`); always use the semantic theme tokens defined in `src/index.css` (`primary`, `error`, `warning`, `muted`, etc.). Add new tokens to the theme if needed.
- **Mobile-first**: mobile is a primary usage device -- design mobile-first, ensure all layouts and interactions work well on small screens
- **Components**: functional components with hooks, one component per file in `src/components/`
- **Types**: shared types in `src/types.ts`
- **No magic numbers**: domain logic constants (team sizes, player limits, thresholds) must be named constants in `src/types.ts`, never hardcoded in components or utils. UI-facing text must interpolate these constants, not repeat literal values.
- **Date format**: always dd/mm order, never mm/dd/yyyy. Use `formatDate` (long locale) or `formatDateShort` (dd/mm/yyyy) from `src/utils/dateUtils.ts`.
- **No duplicated logic**: if the same computation exists in two places, extract it. Check for existing logic before writing new code that searches/filters/computes the same thing.
- **Icon tooltips**: all icons must have a hover/tap tooltip (via the `Tooltip` component in `src/components/Tooltip.tsx`), except gender icons (`GenderIcon`) and navbar navigation icons.
- **Zero lint errors**: run `npm run lint` after changes and fix any errors before considering work done. Never introduce new lint violations.
- **Zero build warnings**: run `npm run build` after changes and fix any warnings or errors before considering work done. Never introduce new build warnings.

## Commands

- `npm run dev` -- start dev server
- `npm run build` -- production build
- `npm run preview` -- preview production build
- `npm run lint` -- run ESLint

### Database

Requires `.env` with `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`.

- `npm run db:link` -- link local project to remote Supabase (run once)
- `npm run db:push` -- push pending migrations to remote database
- `npm run db:migration:new <name>` -- create a new migration file
- `npm run db:test` -- replay the whole migration history against a throwaway
  Postgres and assert the result. **Run this before every `db:push`.** It needs
  no Docker and no Supabase project, and CI runs it on any change under
  `supabase/migrations/`. Migrations are the only part of this repo that moves
  production data and drops tables, and neither `tsc`, eslint nor the Supabase
  linter can see any of their failure modes -- this is the only check that can.
- `npm run db:security-check` -- probe the LIVE api as `anon` (run after a push)

### Supabase security patterns

- **RLS (row level) is the ONLY confidentiality boundary.** The `anon` and `authenticated` roles hold a broad default table-level `SELECT` from Supabase, so `GRANT`s never *restrict* access — neither table-level nor column-level grants can hide a column. Every signed-in user shares the single `authenticated` Postgres role, so grants also cannot distinguish an admin from a basic user. **Never** rely on the absence of a grant, or on a column-level grant, to keep data private — it does not (this caused a critical leak of every player's email/rating/role, see migration `20260622140000`).
- **To keep a table private:** enable RLS and either write explicit policies, or leave zero policies (deny-all) and reach it only through `SECURITY DEFINER` RPCs. Enabling RLS is mandatory — an RLS-disabled table in `public` is world-readable regardless of grants.
- **To hide specific columns** (e.g. `players.email`, `rating`, `role`): the base table's row policy must be false for non-admins (`USING (is_admin())`), and the public, non-sensitive columns are served through an owner-run **`security_invoker = false`** view (`players_public`: `id, name, gender, tier`). A `security_invoker = true` view does NOT add column protection, because the caller can always query the base table directly.
- **Verify, don't assume.** After any change to players/RLS/grants, probe the live REST API as `anon` (`/rest/v1/<table>?select=<sensitive cols>`) and confirm it returns `[]` — the linter does not catch permissive-policy column leaks.
