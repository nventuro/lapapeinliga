export const MIN_TEAM_SIZE = 5;
export const MAX_TEAM_SIZE = 8;
export const MIN_TEAMS = 2;
export const MIN_GENDER_PER_TEAM = 1;
export const MIN_PLAYERS = MIN_TEAM_SIZE * MIN_TEAMS;
export const MAX_RATING_SPREAD = 1.5;

export interface Player {
  id: number;
  name: string;
  gender: 'male' | 'female';
  rating: number; // 1-10
}

export interface Team {
  name: string;
  players: Player[];
}
