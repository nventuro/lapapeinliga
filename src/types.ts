export const MIN_TEAM_SIZE = 5;
export const MAX_TEAM_SIZE = 9;
export const MIN_TEAMS = 2;
export const MIN_GENDER_PER_TEAM = 1;
export const MIN_PLAYERS = MIN_TEAM_SIZE * MIN_TEAMS;
export const MIN_TOURNAMENT_TEAMS = 3;
export const MIN_TOURNAMENT_PLAYERS = MIN_TEAM_SIZE * MIN_TOURNAMENT_TEAMS;
export const MIN_TRAINING_PLAYERS = 2;
export const MIN_RATING = 1;
export const MAX_RATING = 10;
export const MAX_RATING_SPREAD = 0.75;
export const DEFAULT_UNRATED_RATING = 4;

export const LEADERBOARD_MIN_DISPLAY = 10;

// Scoring weights for team assignment optimization
export const WEIGHT_RATING = 10;
export const WEIGHT_GENDER = 6;
export const WEIGHT_STRONG_PREF = 3;
export const WEIGHT_SOFT_PREF = 1;
export const HILL_CLIMB_STARTS = 10;

export type PlayerTier = 'core' | 'sporadic' | 'guest';

export const PLAYER_TIERS: PlayerTier[] = ['core', 'sporadic', 'guest'];

export type UserRole = 'basic' | 'moderator' | 'admin';

export const USER_ROLES: UserRole[] = ['basic', 'moderator', 'admin'];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  basic: 'Sin rol',
  moderator: 'Moderador',
  admin: 'Administrador',
};

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
  email: string | null; // linked Google account, only visible to admins
  role: UserRole; // admin-only column, absent from players_public
}

export function isGuest(player: Player): boolean {
  return player.tier === 'guest';
}

export function effectiveRating(player: Player): number {
  return player.rating ?? DEFAULT_UNRATED_RATING;
}

const GENDER_ORDER: Record<Player['gender'], number> = { male: 0, female: 1 };

export function comparePlayersByGenderThenName(a: Player, b: Player): number {
  const genderDiff = GENDER_ORDER[a.gender] - GENDER_ORDER[b.gender];
  if (genderDiff !== 0) return genderDiff;
  return a.name.localeCompare(b.name);
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

export type ShirtColor = 'light' | 'dark';

export type Location = {
  id: number;
  name: string;
  maps_url: string;
};

export type LocationSelection =
  | { type: 'none' }
  | { type: 'existing'; locationId: number }
  | { type: 'new'; name: string; mapsUrl: string };

export function isValidMapsUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

export function isNewLocationComplete(selection: LocationSelection): boolean {
  return selection.type !== 'new' || (
    !!selection.name.trim() && !!selection.mapsUrl.trim() && isValidMapsUrl(selection.mapsUrl)
  );
}

export const COST_MARKUP_MULTIPLIER = 1;
export const COST_ROUNDING_NEAREST = 100;

export const TOURNAMENT_WIN_POINTS = 3;
export const TOURNAMENT_DRAW_POINTS = 1;

export type EventType = 'match' | 'training' | 'tournament';

export type Event = {
  id: number;
  short_id: string;
  name: string | null;
  type: EventType;
  played_at: string;
  played_at_time: string;
  location_id: number | null;
  cost: number | null;
  payee_alias_cbu: string | null;
};

export type Match = {
  id: number;
  event_id: number;
  winning_team_id: number | null;
};

export type Training = {
  id: number;
  event_id: number;
};

export type Tournament = {
  id: number;
  event_id: number;
  winning_team_id: number | null;
};

export type TournamentTeam = {
  id: number;
  tournament_id: number;
  name: string;
  players: Player[];
};

export type TournamentMatch = {
  id: number;
  tournament_id: number;
  team_a_id: number;
  team_b_id: number;
  score_a: number | null;
  score_b: number | null;
};

export type MatchTeam = {
  id: number;
  match_id: number;
  name: string;
  shirt_color: ShirtColor;
  players: Player[];
};

export type MatchWithDetails = Event & {
  type: 'match';
  match: Match;
  teams: MatchTeam[];
  reserves: Player[];
  location: Location | null;
};

export type TrainingWithDetails = Event & {
  type: 'training';
  training: Training;
  attendees: Player[];
  coaches: Player[];
  location: Location | null;
};

export type TournamentWithDetails = Event & {
  type: 'tournament';
  tournament: Tournament;
  teams: TournamentTeam[];
  reserves: Player[];
  tournamentMatches: TournamentMatch[];
  location: Location | null;
};

export type EventWithDetails = MatchWithDetails | TrainingWithDetails | TournamentWithDetails;

export function allParticipants(event: EventWithDetails): Player[] {
  if (event.type === 'match') {
    return [...event.teams.flatMap((t) => t.players), ...event.reserves];
  }
  if (event.type === 'tournament') {
    return [...event.teams.flatMap((t) => t.players), ...event.reserves];
  }
  return [...event.attendees, ...event.coaches];
}

export type AwardType = 'top_scorer' | 'best_defense' | 'mvp' | 'best_goalie' | 'most_effort' | 'brutality';

export const AWARD_TYPES: AwardType[] = ['mvp', 'most_effort', 'top_scorer', 'best_defense', 'best_goalie', 'brutality'];

export const AWARD_LABELS: Record<AwardType, string> = {
  top_scorer: 'Gol de Oro',
  best_defense: 'Muralla',
  mvp: 'Figura del Partido',
  best_goalie: 'Manos de Acero',
  most_effort: 'Mas Huevo',
  brutality: 'El Carnicero',
};

export const AWARD_DESCRIPTIONS: Record<AwardType, string> = {
  top_scorer: 'Ese gol que se va a contar en el próximo asado',
  best_defense: 'El terror de los delanteros, no dejó pasar a nadie',
  mvp: 'Brilló a su manera y se ganó todos los aplausos',
  best_goalie: 'Sacó hasta las que no se sacan',
  most_effort: 'Garra pura: no bajó los brazos ni un minuto',
  brutality: 'Llegó tarde a la pelota, justo a tiempo para el rival',
};

export type AwardVoteWindowState = 'pending' | 'open' | 'closed' | 'n/a';

export type EventAwardWindow = {
  state: AwardVoteWindowState;
  opens_at: string | null;
  closes_at: string | null;
  voter_count: number;
};

export type AwardResultState = 'pending' | 'winner' | 'tied' | 'no_votes' | 'n/a';

export type AwardResult = {
  award_type: AwardType;
  state: AwardResultState;
  winner_id: number | null;
  tied_candidates: number[] | null;
};

// Media gallery constants
export const EQUIPO_TAG_NAME = 'equipo';

export const THUMBNAIL_MAX_WIDTH = 400;
export const FULL_IMAGE_MAX_WIDTH = 1600;

export const EVENT_MEDIA_PREVIEW_COUNT = 3;

export type MediaType = 'image' | 'video';

export type MediaItem = {
  id: number;
  event_id: number | null;
  storage_path: string;
  thumbnail_path: string;
  caption: string | null;
  taken_at: string;
  media_type: MediaType;
  aspect_ratio: number;
};

export type MediaTag = {
  id: number;
  name: string;
};

export type TaggedPlayer = Pick<Player, 'id' | 'name'>;

export type MediaItemWithTags = MediaItem & {
  tags: MediaTag[];
  taggedPlayers: TaggedPlayer[];
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
