export const MIN_TEAM_SIZE = 5;
export const MAX_TEAM_SIZE = 9;
export const MIN_TEAMS = 2;
/** A regular (non-tournament) match is always exactly two teams. */
export const MATCH_TEAM_COUNT = 2;
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

/** How many ranks a leaderboard shows before it has to be expanded. A tie is
 *  never split, so a rank is taken whole or not at all. */
export const LEADERBOARD_PODIUM_RANKS = 3;

/** Row ceiling for that collapsed view. Low-range stats tie heavily -- five
 *  players share first place at "partidos vs externos" -- and without a ceiling
 *  the three ranks can be most of the list, leaving nothing to expand. A single
 *  rank wider than this still shows whole, since the alternative is cutting
 *  players with an equal claim to the place. */
export const LEADERBOARD_PODIUM_MAX_ROWS = 5;

/** Games a player needs before they place in the effectiveness ranking. Without
 *  a floor, one game won reads as a perfect record and tops the table. */
export const EFFECTIVENESS_MIN_GAMES = 8;

/** Max length for player names; the database enforces the same cap. */
export const MAX_PLAYER_NAME_LENGTH = 80;

/** How long the winner card glows after a result is recorded. */
export const WINNER_GLOW_MS = 4000;

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
  tier: PlayerTier | null; // null when masked: the core/sporadic distinction is admin-only (guests are still 'guest')
  /**
   * Admin-only columns. Non-admin sessions read from `players_public`, which
   * does not serve these, so they are undefined there — optional so any code
   * that needs them is forced to handle the non-admin case instead of finding
   * `undefined` at runtime behind a lying type.
   */
  rating?: number | null; // 1-10, null for unrated guests
  email?: string | null; // linked Google account
  role?: UserRole;
}

export function isGuest(player: Player): boolean {
  return player.tier === 'guest';
}

export type RosterGroup = { key: string; label: string; players: Player[] };

/**
 * Groups players for roster display, each group sorted by name.
 *
 * When `showTiers` is true (admins) the full core/sporadic/guest split is shown.
 * Otherwise the core-vs-sporadic distinction is hidden: every non-guest
 * collapses into a single unlabeled group and only guests remain separately
 * identified. This mirrors the masking enforced in `players_public` (where
 * non-admin callers see `tier` as 'guest' or null) and also covers an admin
 * previewing as a non-admin, whose data still holds the real tiers.
 */
export function groupPlayersForRoster(players: Player[], showTiers: boolean): RosterGroup[] {
  const byName = compareByName;
  if (showTiers) {
    return PLAYER_TIERS
      .map((tier) => ({
        key: tier,
        label: TIER_GROUP_LABELS[tier],
        players: players.filter((p) => p.tier === tier).sort(byName),
      }))
      .filter((g) => g.players.length > 0);
  }
  return [
    { key: 'members', label: '', players: players.filter((p) => p.tier !== 'guest').sort(byName) },
    { key: 'guest', label: TIER_GROUP_LABELS.guest, players: players.filter((p) => p.tier === 'guest').sort(byName) },
  ].filter((g) => g.players.length > 0);
}

export function effectiveRating(player: Player): number {
  return player.rating ?? DEFAULT_UNRATED_RATING;
}

const GENDER_ORDER: Record<Player['gender'], number> = { male: 0, female: 1 };

/** Canonical alphabetical comparator for anything with a name (players, teams, tags). */
export function compareByName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

export function comparePlayersByGenderThenName(a: Player, b: Player): number {
  const genderDiff = GENDER_ORDER[a.gender] - GENDER_ORDER[b.gender];
  if (genderDiff !== 0) return genderDiff;
  return compareByName(a, b);
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

export type ExternalTeamSelection =
  | { type: 'none' }
  | { type: 'existing'; externalTeamId: number }
  | { type: 'new'; name: string };

export function isExternalTeamSelectionComplete(selection: ExternalTeamSelection): boolean {
  if (selection.type === 'existing') return true;
  if (selection.type === 'new') return !!selection.name.trim();
  return false;
}

export const COST_MARKUP_MULTIPLIER = 1;
export const COST_ROUNDING_NEAREST = 100;

export const TOURNAMENT_WIN_POINTS = 3;
export const TOURNAMENT_DRAW_POINTS = 1;

export type EventType = 'match' | 'training' | 'tournament' | 'external_match' | 'social';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  match: 'Partido',
  training: 'Entrenamiento',
  tournament: 'Torneo',
  external_match: 'Partido externo',
  social: 'Evento',
};

/**
 * Compile-time exhaustiveness guard for per-EventType dispatch: the call only
 * typechecks in a branch where every variant has been handled, so adding a new
 * EventType turns every dispatch that needs a branch into a compile error
 * instead of a silent fallthrough. If it's ever reached at runtime (a client
 * build older than the database), it returns the fallback so the UI degrades
 * instead of crashing.
 */
export function unhandledEventType<T>(type: never, fallback: T): T {
  console.warn(`Unhandled event type: ${String(type)}`);
  return fallback;
}

/**
 * Whether the type keeps a list of participants. Social events don't: they are
 * just the date/time/place plus photos, so photo tagging falls back to the
 * whole roster.
 *
 * Compile-time mirror of event_types.has_participants (same pattern as
 * AwardType vs the award_types table).
 */
export function hasParticipantList(type: EventType): boolean {
  return type !== 'social';
}

/**
 * Whether the event's cost and payee are tracked. Today this matches
 * hasParticipantList — a cost exists to be split among participants — but they
 * are distinct capabilities, so money UI must gate on this one.
 *
 * Compile-time mirror of event_types.has_finances.
 */
export function hasFinances(type: EventType): boolean {
  return hasParticipantList(type);
}

/**
 * Whether the type runs award voting (and, gated on it, event feedback).
 *
 * Compile-time mirror of event_types.votable, which the vote/feedback RPCs
 * enforce (via the _event_vote_window state).
 */
export function hasAwards(type: EventType): boolean {
  return type === 'match' || type === 'tournament';
}

/** Display name for the papeinliga side in an external match. */
export const OUR_TEAM_NAME = 'La Papeinliga';

/**
 * Financial details, from the mod/admin-only `event_finances` table. `null`
 * when no row exists or the caller cannot see it. Cost and payee are kept
 * together because they are only meaningful as a pair ("send $X to Y") —
 * never spread them back into independent top-level fields.
 */
export type EventFinances = {
  cost: number | null;
  payee_alias_cbu: string | null;
};

export type Event = {
  id: number;
  short_id: string;
  name: string | null;
  type: EventType;
  played_at: string;
  played_at_time: string;
  location_id: number | null;
  /** The winning event_teams row, for team-structured types; null otherwise. */
  winning_team_id: number | null;
  finances: EventFinances | null;
};

/**
 * A participant's role on an event, mirroring event_participants.kind.
 * team_member is a rostered player (with a team for matches/tournaments,
 * without one for external matches); the rest are self-explanatory.
 */
export type ParticipantKind = 'team_member' | 'reserve' | 'attendee' | 'coach';

/** A team within an event. shirt_color is null for types that don't track one. */
export type EventTeam = {
  id: number;
  event_id: number;
  name: string;
  shirt_color: ShirtColor | null;
  players: Player[];
};

export type TournamentMatch = {
  id: number;
  event_id: number;
  team_a_id: number;
  team_b_id: number;
  score_a: number | null;
  score_b: number | null;
};

export type ExternalTeam = {
  id: number;
  name: string;
};

export type ExternalMatch = {
  id: number;
  event_id: number;
  external_team_id: number;
  our_score: number | null;
  their_score: number | null;
};

/** A papeinliga player in an external match, with the goals they scored. */
export type ExternalMatchPlayer = {
  player: Player;
  goals: number;
};

export type ExternalMatchResult = 'win' | 'loss' | 'draw';

export const EXTERNAL_RESULT_LABELS: Record<ExternalMatchResult, string> = {
  win: 'Ganamos',
  loss: 'Perdimos',
  draw: 'Empate',
};

/**
 * Derives the result for our side from the recorded scores, or null when the
 * match has not been scored yet. Takes the scores directly (not the row) so
 * call sites never need to fabricate an `ExternalMatch` to use it.
 */
export function externalMatchResult(ourScore: number | null, theirScore: number | null): ExternalMatchResult | null {
  if (ourScore == null || theirScore == null) return null;
  if (ourScore > theirScore) return 'win';
  if (ourScore < theirScore) return 'loss';
  return 'draw';
}

export type MatchWithDetails = Event & {
  type: 'match';
  teams: EventTeam[];
  reserves: Player[];
  location: Location | null;
};

export type TrainingWithDetails = Event & {
  type: 'training';
  attendees: Player[];
  coaches: Player[];
  location: Location | null;
};

export type TournamentWithDetails = Event & {
  type: 'tournament';
  teams: EventTeam[];
  reserves: Player[];
  tournamentMatches: TournamentMatch[];
  location: Location | null;
};

export type ExternalMatchWithDetails = Event & {
  type: 'external_match';
  externalMatch: ExternalMatch;
  opponent: ExternalTeam;
  roster: ExternalMatchPlayer[];
  reserves: ExternalMatchPlayer[];
  location: Location | null;
};

/** A social event has no child record: the event row plus its venue is all there is. */
export type SocialWithDetails = Event & {
  type: 'social';
  location: Location | null;
};

export type EventWithDetails =
  | MatchWithDetails
  | TrainingWithDetails
  | TournamentWithDetails
  | ExternalMatchWithDetails
  | SocialWithDetails;

export function allParticipants(event: EventWithDetails): Player[] {
  if (event.type === 'social') {
    return [];
  }
  if (event.type === 'match') {
    return [...event.teams.flatMap((t) => t.players), ...event.reserves];
  }
  if (event.type === 'tournament') {
    return [...event.teams.flatMap((t) => t.players), ...event.reserves];
  }
  if (event.type === 'external_match') {
    return [...event.roster, ...event.reserves].map((r) => r.player);
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

export const EVENT_FEEDBACK_MAX_LENGTH = 2000;

// Media gallery constants
export const EQUIPO_TAG_NAME = 'equipo';

export const THUMBNAIL_MAX_WIDTH = 400;
export const FULL_IMAGE_MAX_WIDTH = 1600;

// Upload size caps; the media-upload edge function enforces the same limits
// server-side by signing the Content-Length of each presigned upload.
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;

// Video processing
export const VIDEO_BOOMERANG_DEFAULT_SECONDS = 3;
export const VIDEO_MIN_TRIM_GAP_SECONDS = 0.2;
export const VIDEO_PROCESSING_FPS = 15;

export const EVENT_MEDIA_PREVIEW_COUNT = 3;

/** How much of a player's history their profile previews before "ver todas". */
export const PLAYER_MEDIA_PREVIEW_COUNT = 6;
export const PLAYER_EVENT_PREVIEW_COUNT = 5;

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
