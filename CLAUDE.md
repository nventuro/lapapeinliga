# La Papeinliga

Friendly soccer group team organizer — static site POC.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Supabase (database + auth) — migrations in `supabase/migrations/`

## Conventions

- **Code language**: All code, comments, variable names, types, and file names in English
- **UI language**: All user-facing text in Argentinian Spanish (voseo, local expressions)
- **Styling**: Tailwind utility classes exclusively — no CSS modules or styled-components. Never use hardcoded Tailwind color scales (e.g. `red-400`, `amber-600`); always use the semantic theme tokens defined in `src/index.css` (`primary`, `error`, `warning`, `muted`, etc.). Add new tokens to the theme if needed.
- **Mobile-first**: Mobile is a primary usage device — design mobile-first, ensure all layouts and interactions work well on small screens
- **Components**: Functional components with hooks, one component per file in `src/components/`
- **Types**: Shared types in `src/types.ts`
- **No magic numbers**: Domain logic constants (team sizes, player limits, thresholds) must be named constants in `src/types.ts`, never hardcoded in components or utils. UI-facing text must interpolate these constants, not repeat literal values.
- **Date format**: Always dd/mm order, never mm/dd/yyyy. Use `formatDate` (long locale) or `formatDateShort` (dd/mm/yyyy) from `src/utils/dateUtils.ts`.
- **No duplicated logic**: If the same computation exists in two places, extract it. Check for existing logic before writing new code that searches/filters/computes the same thing.
- **Zero lint errors**: Run `npm run lint` after changes and fix any errors before considering work done. Never introduce new lint violations.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview production build
- `npm run lint` — run ESLint

### Database

Requires `.env` with `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` (see `.env` template).

- `npm run db:link` — link local project to remote Supabase (run once)
- `npm run db:push` — push pending migrations to remote database
- `npm run db:migration:new <name>` — create a new migration file
