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

### Supabase security patterns

- **`players_public` view uses `security_invoker = true`** -- it runs with the caller's privileges, not the owner's. Non-admin roles can only read columns explicitly granted via `GRANT SELECT (col, ...)` on the `players` table. When adding a new column to `players_public`, you must also add a column-level grant for it; omitting the grant causes a loud "permission denied" error (safe fail-closed).
