# La Papeinliga

Team organizer for a friendly soccer group. Browse matchdays and stats publicly, or sign in as admin to manage players, sort balanced teams, record results, upload photos and videos, and share details via WhatsApp.

## Setup

```bash
npm install
npm run dev
```

### Environment

Create a `.env` file in the project root:

```
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_DB_PASSWORD=your-db-password
```

### Database

Migrations live in `supabase/migrations/`.

```bash
npm run db:link              # link to remote Supabase (run once)
npm run db:push              # push pending migrations
npm run db:migration:new foo # create a new migration
```

## Features

The site is publicly accessible. Admin features require Google OAuth sign-in.

### Public

- **Matchdays** -- browse past matchdays with team rosters, reserves, winners, and individual awards
- **Tournaments** -- view multi-team tournaments with match-by-match scores and standings tables
- **Training sessions** -- view training sessions with coach assignments
- **Stats** -- player leaderboards for awards, games won, and games played
- **Media gallery** -- browse photos and videos from events, with player tagging

### Admin

- **Player management** -- add, edit, and delete players. Each player has a tier (core, sporadic, guest) that determines grouping and defaults
- **Team sorting** -- select attending players, choose team count, and run a hill-climbing optimizer that balances ratings, gender distribution, and player preferences
- **Manual adjustments** -- move players between teams and reserves, lock players in place and reshuffle, view a per-category score breakdown
- **Save events** -- save team assignments as matchdays or tournaments with date, time, location, cost, payee, and team names
- **Record results** -- set the winning team and individual awards (top scorer, best defense, best player, best goalie, most effort); for tournaments, record match-by-match scores
- **Media upload** -- upload photos and videos to events with in-browser cropping, compression, and video trimming
- **WhatsApp sharing** -- share matchday details (teams, time, location, per-player cost) to WhatsApp

## Team Sorting Algorithm

The sorter uses multi-start hill climbing:

1. **Seed** -- if enough players of each gender exist, seeds each team with at least one of each via round-robin, then fills randomly
2. **Hill climb** -- iteratively tries all inter-team and team-reserve swaps, picking the single best improvement per iteration until no swap helps
3. **Repeat** -- runs 10 times from different random seeds, keeps the best result

The score is a weighted sum of penalties (all &le; 0, higher is better):

| Category | Weight | Penalty |
| --- | --- | --- |
| Rating balance | 10 | Sum of squared deviations of team averages from the overall average |
| Gender balance | 6 | Sum of absolute deviations of team gender ratios from the expected ratio |
| Strong preferences | 3 | Count of `strongly_prefer_with` pairs on different teams |
| Soft preferences | 1 | Count of `prefer_with` pairs split + `prefer_not_with` pairs together |

Hard constraints (never violated): teams differ by at most 1 in size; each team has at least 1 player of each gender when feasible.

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Postgres + auth via Google OAuth + Edge Functions for presigned uploads)
- Cloudflare R2 (media storage)
- GitHub Pages (auto-deploy on push to `main`)

---

Built with [Claude](https://claude.ai)
