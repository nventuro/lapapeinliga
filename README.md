# La Papeinliga

Team organizer for a friendly soccer group. Select attending players, configure team count, and sort into balanced teams using a hill-climbing optimizer that respects player preferences — then manually adjust if needed.

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
2. **Manage players** — admins can add, edit, and delete players from the roster via a dedicated management page. Players have a tier (core, sporadic, guest) that determines grouping and defaults.
3. **Select players** — check who's attending from the roster, grouped by tier
4. **Configure teams** — choose how many teams to create (valid splits shown based on team size limits)
5. **Sort teams** — a hill-climbing optimizer distributes players into balanced teams, minimizing rating spread, gender imbalance, and preference violations
6. **Adjust** — move players between teams and reserves, re-sort as needed. A score breakdown shows per-category penalties and specific preference violations. Per-team cards flag size errors and gender warnings.
7. **Lock & reshuffle** — lock specific players into their current teams, then reshuffle. Locked players stay put while the optimizer redistributes everyone else.
8. **Save as matchday** — admins can save the current team assignment as a matchday ("fecha"), picking a date and editing team names
9. **Browse matchdays** — view past matchdays from the "Fechas" tab, with team rosters and reserves
10. **Record results** — admins can set the winning team and individual awards (top scorer, best defense, best player, best goalie, most effort) on any matchday
11. **Stats** — view player leaderboards for total awards, per-category awards, games won, and games played

## Team Sorting Algorithm

The sorter uses a multi-start hill-climbing optimizer:

1. **Initial assignment** — if enough players of each gender exist, seeds each team with at least one of each via round-robin, then fills randomly. Otherwise, shuffles randomly.
2. **Hill climbing** — iteratively tries all inter-team player swaps and team-reserve swaps. Picks the single best improvement per iteration, repeating until no swap improves the score.
3. **Multi-start** — runs the above 10 times from different random seeds and keeps the best result.

The score is a weighted sum of four penalties (all <= 0, higher is better):

| Category | Weight | Penalty |
|---|---|---|
| Rating balance | 10 | Sum of squared deviations of team averages from overall average |
| Gender balance | 6 | Sum of absolute deviations of team gender ratios from expected ratio |
| Strong preferences | 3 | Count of `strongly_prefer_with` pairs placed on different teams |
| Soft preferences | 1 | Count of `prefer_with` pairs split + `prefer_not_with` pairs together |

Hard constraints (never violated): teams differ by at most 1 in size, and each team has at least 1 player of each gender (when feasible).

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (database + Google OAuth)
- Hosted on GitHub Pages

---

Built with [Claude](https://claude.ai)
