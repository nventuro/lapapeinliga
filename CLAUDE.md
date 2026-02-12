# La Papeinliga

Friendly soccer group team organizer — static site POC.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Supabase (database + auth) — migrations in `supabase/migrations/`

## Conventions

- **Code language**: All code, comments, variable names, types, and file names in English
- **UI language**: All user-facing text in Argentinian Spanish (voseo, local expressions)
- **Styling**: Tailwind utility classes exclusively — no CSS modules or styled-components
- **Mobile-first**: Mobile is a primary usage device — design mobile-first, ensure all layouts and interactions work well on small screens
- **Components**: Functional components with hooks, one component per file in `src/components/`
- **Types**: Shared types in `src/types.ts`

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
