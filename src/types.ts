export const MIN_TEAM_SIZE = 5;
export const MAX_TEAM_SIZE = 8;
export const MIN_TEAMS = 2;
export const MIN_GENDER_PER_TEAM = 1;
export const MIN_PLAYERS = MIN_TEAM_SIZE * MIN_TEAMS;
export const MIN_RATING = 1;
export const MAX_RATING = 10;
export const MAX_RATING_SPREAD = 0.75;

// Scoring weights for team assignment optimization
export const WEIGHT_RATING = 10;
export const WEIGHT_GENDER = 6;
export const WEIGHT_STRONG_PREF = 3;
export const WEIGHT_SOFT_PREF = 1;
export const HILL_CLIMB_STARTS = 10;

export interface Player {
  id: number;
  name: string;
  gender: 'male' | 'female';
  rating: number; // 1-10
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
