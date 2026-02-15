export const MIN_TEAM_SIZE = 5;
export const MAX_TEAM_SIZE = 8;
export const MIN_TEAMS = 2;
export const MIN_GENDER_PER_TEAM = 1;
export const MIN_PLAYERS = MIN_TEAM_SIZE * MIN_TEAMS;
export const MIN_RATING = 1;
export const MAX_RATING = 10;
export const MAX_RATING_SPREAD = 0.75;
export const DEFAULT_UNRATED_RATING = 4;

// Scoring weights for team assignment optimization
export const WEIGHT_RATING = 10;
export const WEIGHT_GENDER = 6;
export const WEIGHT_STRONG_PREF = 3;
export const WEIGHT_SOFT_PREF = 1;
export const HILL_CLIMB_STARTS = 10;

export type PlayerTier = 'core' | 'sporadic' | 'guest';

export const PLAYER_TIERS: PlayerTier[] = ['core', 'sporadic', 'guest'];

export const TIER_LABELS: Record<PlayerTier, string> = {
  core: 'Fijo',
  sporadic: 'Esporádico',
  guest: 'Invitado',
};

export const TIER_GROUP_LABELS: Record<PlayerTier, string> = {
  core: 'Fijos',
  sporadic: 'Esporádicos',
  guest: 'Invitados',
};

export const TIER_ORDER: Record<PlayerTier, number> = {
  core: 0,
  sporadic: 1,
  guest: 2,
};

export interface Player {
  id: number;
  name: string;
  gender: 'male' | 'female';
  rating: number | null; // 1-10, null for unrated guests
  tier: PlayerTier;
}

export function isGuest(player: Player): boolean {
  return player.tier === 'guest';
}

export function effectiveRating(player: Player): number {
  return player.rating ?? DEFAULT_UNRATED_RATING;
}

export type PreferenceType = 'prefer_with' | 'strongly_prefer_with' | 'prefer_not_with';

export interface PlayerPreference {
  player_a_id: number;
  player_b_id: number;
  preference: PreferenceType;
}

export interface Team {
  name: string;
  players: Player[];
}

/** Maps player ID → team index (or 'reserves') for locked players. */
export type PlayerLocks = Map<number, number | 'reserves'>;

export type Matchday = {
  id: number;
  played_at: string;
  winning_team_id: number | null;
  top_scorer_id: number | null;
  best_defense_id: number | null;
  mvp_id: number | null;
  best_goalie_id: number | null;
  most_effort_id: number | null;
};

export type MatchdayTeam = {
  id: number;
  matchday_id: number;
  name: string;
  players: Player[];
};

export type MatchdayWithDetails = Matchday & {
  teams: MatchdayTeam[];
  reserves: Player[];
};

export type AwardType = 'top_scorer' | 'best_defense' | 'mvp' | 'best_goalie' | 'most_effort';

export const AWARD_TYPES: AwardType[] = ['top_scorer', 'best_defense', 'mvp', 'best_goalie', 'most_effort'];

export const AWARD_LABELS: Record<AwardType, string> = {
  top_scorer: 'Goleador',
  best_defense: 'Mejor defensa',
  mvp: 'Figura del partido',
  best_goalie: 'Mejor arquero',
  most_effort: 'Más huevo',
};

export interface ScoreBreakdown {
  rating: { raw: number; weighted: number };
  gender: { raw: number; weighted: number };
  strongPrefs: {
    violations: { playerA: string; playerB: string }[];
    raw: number;
    weighted: number;
  };
  softPrefs: {
    violations: { playerA: string; playerB: string; kind: 'split' | 'together' }[];
    raw: number;
    weighted: number;
  };
  total: number;
}
