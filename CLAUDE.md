# La Papeinliga

Friendly soccer group team organizer — static site POC.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- No backend — player data lives in `src/data/players.ts`

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
