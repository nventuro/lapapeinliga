import { useMemo } from 'react';
import type {
  EventFinances, EventType, EventWithDetails, ExternalMatch, ExternalMatchPlayer, ExternalTeam,
  Location, Match, MatchTeam, Player, ShirtColor, Tournament, TournamentMatch, TournamentTeam, Training,
} from '../types';
import { unhandledEventType } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { useSupabaseQuery } from './useSupabaseQuery';

// One embedded select fetches the event and every child it can have; RLS
// nulls out event_finances for non-mods. This replaces a 6-9 round-trip
// waterfall that discarded every error along the way.
const EVENT_DETAIL_SELECT = `
  *,
  event_finances(cost, payee_alias_cbu),
  location:locations(*),
  matches(*, match_teams!match_teams_match_id_fkey(id, match_id, name, shirt_color, match_team_players(player_id)), match_reserves(player_id)),
  trainings(*, training_attendees(player_id), training_coaches(player_id)),
  tournaments(*, tournament_teams!tournament_teams_tournament_id_fkey(id, tournament_id, name, tournament_team_players(player_id)), tournament_reserves(player_id), tournament_matches(*)),
  external_matches(*, external_team:external_teams(id, name), external_match_players(player_id, goals), external_match_reserves(player_id, goals))
`;

type PlayerRef = { player_id: number };
type RosterRef = { player_id: number; goals: number };

type DetailRow = {
  id: number;
  short_id: string;
  name: string | null;
  type: EventType;
  played_at: string;
  played_at_time: string;
  location_id: number | null;
  event_finances: EventFinances | null;
  location: Location | null;
  matches: (Match & {
    match_teams: { id: number; match_id: number; name: string; shirt_color: ShirtColor; match_team_players: PlayerRef[] }[];
    match_reserves: PlayerRef[];
  }) | null;
  trainings: (Training & { training_attendees: PlayerRef[]; training_coaches: PlayerRef[] }) | null;
  tournaments: (Tournament & {
    tournament_teams: { id: number; tournament_id: number; name: string; tournament_team_players: PlayerRef[] }[];
    tournament_reserves: PlayerRef[];
    tournament_matches: TournamentMatch[];
  }) | null;
  external_matches: (ExternalMatch & {
    external_team: ExternalTeam | null;
    external_match_players: RosterRef[];
    external_match_reserves: RosterRef[];
  }) | null;
};

function mapRow(row: DetailRow, players: Player[]): EventWithDetails | null {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const resolve = (refs: PlayerRef[]): Player[] =>
    refs.map((r) => playerMap.get(r.player_id)).filter((p): p is Player => p !== undefined);
  const resolveRoster = (refs: RosterRef[]): ExternalMatchPlayer[] =>
    refs.flatMap((r) => {
      const player = playerMap.get(r.player_id);
      return player ? [{ player, goals: r.goals }] : [];
    });
  const byId = (a: { id: number }, b: { id: number }) => a.id - b.id;

  const base = {
    id: row.id,
    short_id: row.short_id,
    name: row.name,
    type: row.type,
    played_at: row.played_at,
    played_at_time: row.played_at_time,
    location_id: row.location_id,
    finances: row.event_finances,
  };

  if (row.type === 'match') {
    if (!row.matches) return null;
    const { match_teams, match_reserves, ...match } = row.matches;
    const teams: MatchTeam[] = [...match_teams].sort(byId).map(({ match_team_players, ...team }) => ({
      ...team,
      players: resolve(match_team_players),
    }));
    return { ...base, type: 'match', match, teams, reserves: resolve(match_reserves), location: row.location };
  }

  if (row.type === 'tournament') {
    if (!row.tournaments) return null;
    const { tournament_teams, tournament_reserves, tournament_matches, ...tournament } = row.tournaments;
    const teams: TournamentTeam[] = [...tournament_teams].sort(byId).map(({ tournament_team_players, ...team }) => ({
      ...team,
      players: resolve(tournament_team_players),
    }));
    return {
      ...base,
      type: 'tournament',
      tournament,
      teams,
      reserves: resolve(tournament_reserves),
      tournamentMatches: [...tournament_matches].sort(byId),
      location: row.location,
    };
  }

  if (row.type === 'external_match') {
    if (!row.external_matches || !row.external_matches.external_team) return null;
    const { external_team, external_match_players, external_match_reserves, ...externalMatch } = row.external_matches;
    return {
      ...base,
      type: 'external_match',
      externalMatch,
      opponent: external_team,
      roster: resolveRoster(external_match_players),
      reserves: resolveRoster(external_match_reserves),
      location: row.location,
    };
  }

  if (row.type === 'training') {
    if (!row.trainings) return null;
    const { training_attendees, training_coaches, ...training } = row.trainings;
    return {
      ...base,
      type: 'training',
      training,
      attendees: resolve(training_attendees),
      coaches: resolve(training_coaches),
      location: row.location,
    };
  }

  if (row.type === 'social') {
    return { ...base, type: 'social', location: row.location };
  }

  // A type this build doesn't know: render as "not found" instead of crashing.
  return unhandledEventType(row.type, null);
}

interface UseEventDetailResult {
  event: EventWithDetails | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEventDetail(shortId: string | undefined): UseEventDetailResult {
  const { players } = useAppContext();

  // Player resolution happens OUTSIDE the query (in the memo below): a
  // context-roster refetch must not blank the page by invalidating the query
  // key — it only needs to re-map names over the already-fetched row.
  const { data, loading, error, refetch } = useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_DETAIL_SELECT)
      .eq('short_id', shortId!)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as DetailRow | null;
  }, [shortId], { enabled: !!shortId });

  const event = useMemo(() => (data ? mapRow(data, players) : null), [data, players]);

  return { event, loading, error, refetch };
}
