# La Papeinliga

Team organizer for a friendly soccer group. Select attending players, configure team count, and randomly sort into balanced teams — then manually adjust if needed.

## Setup

```bash
npm install
npm run dev
```

Requires a Supabase project for database and Google OAuth. Copy `.env` template and fill in `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`.

### Database

```bash
npm run db:link              # link to remote Supabase project (run once)
npm run db:push              # push pending migrations to remote database
npm run db:migration:new foo # create a new migration file
```

Migrations live in `supabase/migrations/`.

## How It Works

1. **Sign in** — authenticate with Google
2. **Select players** — check who's attending from the roster
3. **Configure teams** — choose how many teams to create (valid splits shown based on team size limits)
4. **Sort teams** — randomly distribute players into balanced teams
5. **Adjust** — move players between teams and reserves, re-sort as needed. Errors and warnings flag team size violations and gender imbalances.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (database + Google OAuth)
- Hosted on GitHub Pages

---

Built with [Claude](https://claude.ai)
