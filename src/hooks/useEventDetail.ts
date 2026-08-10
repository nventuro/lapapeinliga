import { useMemo } from 'react';
import type {
  EventFinances, EventTeam, EventType, EventWithDetails, ExternalMatch, ExternalMatchPlayer,
  ExternalTeam, Location, ParticipantKind, Player, ShirtColor, TournamentMatch,
} from '../types';
import { unhandledEventType } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { useSupabaseQuery } from './useSupabaseQuery';

// One embedded select fetches the event and every child it can have; RLS
// nulls out event_finances for non-mods. Teams and participants are unified
// tables shared by every event type, so there is no per-type plumbing here —
// only external_matches remains as type-specific data (opponent + scores).
// The events→event_teams embed needs the FK hint because the winner FK on
// events creates a second relationship between the two tables.
const EVENT_DETAIL_SELECT = `
  *,
  event_finances(cost, payee_alias_cbu),
  location:locations(*),
  event_teams!event_teams_event_id_fkey(id, event_id, name, shirt_color),
  event_participants(player_id, kind, team_id, goals),
  tournament_matches(id, event_id, team_a_id, team_b_id, score_a, score_b),
  external_matches(*, external_team:external_teams(id, name))
`;

type ParticipantRow = { player_id: number; kind: ParticipantKind; team_id: number | null; goals: number };
type TeamRow = { id: number; event_id: number; name: string; shirt_color: ShirtColor | null };

type DetailRow = {
  id: number;
  short_id: string;
  name: string | null;
  type: EventType;
  played_at: string;
  played_at_time: string;
  location_id: number | null;
  winning_team_id: number | null;
  video_key: string | null;
  event_finances: EventFinances | null;
  location: Location | null;
  event_teams: TeamRow[];
  event_participants: ParticipantRow[];
  tournament_matches: TournamentMatch[];
  external_matches: (ExternalMatch & { external_team: ExternalTeam | null }) | null;
};

function mapRow(row: DetailRow, players: Player[]): EventWithDetails | null {
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const resolve = (refs: ParticipantRow[]): Player[] =>
    refs.map((r) => playerMap.get(r.player_id)).filter((p): p is Player => p !== undefined);
  const resolveRoster = (refs: ParticipantRow[]): ExternalMatchPlayer[] =>
    refs.flatMap((r) => {
      const player = playerMap.get(r.player_id);
      return player ? [{ player, goals: r.goals }] : [];
    });
  const byId = (a: { id: number }, b: { id: number }) => a.id - b.id;

  const ofKind = (kind: ParticipantKind) => row.event_participants.filter((p) => p.kind === kind);
  const teams: EventTeam[] = [...row.event_teams].sort(byId).map((team) => ({
    ...team,
    players: resolve(row.event_participants.filter((p) => p.kind === 'team_member' && p.team_id === team.id)),
  }));

  const base = {
    id: row.id,
    short_id: row.short_id,
    name: row.name,
    type: row.type,
    played_at: row.played_at,
    played_at_time: row.played_at_time,
    location_id: row.location_id,
    winning_team_id: row.winning_team_id,
    finances: row.event_finances,
    video_key: row.video_key,
    location: row.location,
  };

  if (row.type === 'match') {
    return { ...base, type: 'match', teams, reserves: resolve(ofKind('reserve')) };
  }

  if (row.type === 'tournament') {
    return {
      ...base,
      type: 'tournament',
      teams,
      reserves: resolve(ofKind('reserve')),
      tournamentMatches: [...row.tournament_matches].sort(byId),
    };
  }

  if (row.type === 'external_match') {
    if (!row.external_matches || !row.external_matches.external_team) return null;
    const { external_team, ...externalMatch } = row.external_matches;
    return {
      ...base,
      type: 'external_match',
      externalMatch,
      opponent: external_team,
      roster: resolveRoster(ofKind('team_member')),
      reserves: resolveRoster(ofKind('reserve')),
    };
  }

  if (row.type === 'training') {
    return { ...base, type: 'training', attendees: resolve(ofKind('attendee')), coaches: resolve(ofKind('coach')) };
  }

  if (row.type === 'social') {
    return { ...base, type: 'social' };
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
