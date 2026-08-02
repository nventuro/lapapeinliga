import type { AwardType, EventType, ParticipantKind } from '../types';
import { AWARD_TYPES } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

export interface EventStats {
  gamesPlayed: Map<number, number>;
  gamesWon: Map<number, number>;
  awardCounts: Map<AwardType, Map<number, number>>;
  trainingsAttended: Map<number, number>;
  trainingsCoached: Map<number, number>;
  externalMatchesPlayed: Map<number, number>;
  eventParticipants: number[][];
  /** Every event each player took part in, any type. Keyed by player id. */
  eventIdsByPlayer: Map<number, Set<number>>;
  /** The subset of those a player was on the winning side of. */
  wonEventIdsByPlayer: Map<number, Set<number>>;
  loading: boolean;
  error: string | null;
}

const EMPTY_COUNTS: Map<number, number> = new Map();
const EMPTY_AWARDS: Map<AwardType, Map<number, number>> = new Map();
const EMPTY_EVENTS: number[][] = [];
const EMPTY_EVENT_IDS: Map<number, Set<number>> = new Map();

const remember = (map: Map<number, Set<number>>, playerId: number, eventId: number) => {
  const seen = map.get(playerId);
  if (seen) seen.add(eventId);
  else map.set(playerId, new Set([eventId]));
};

type EventRow = { id: number; type: EventType; winning_team_id: number | null };
type ParticipantRow = { event_id: number; player_id: number; kind: ParticipantKind; team_id: number | null };

const increment = (map: Map<number, number>, playerId: number) =>
  map.set(playerId, (map.get(playerId) ?? 0) + 1);

export function useEventStats(): EventStats {
  const { data, loading, error } = useSupabaseQuery(async () => {
    const [eventsResult, participantsResult, resolvedAwardsResult] = await Promise.all([
      supabase.from('events').select('id, type, winning_team_id'),
      supabase.from('event_participants').select('event_id, player_id, kind, team_id'),
      supabase.rpc('get_resolved_event_awards'),
    ]);

    const queryError = eventsResult.error || participantsResult.error || resolvedAwardsResult.error;
    if (queryError) throw new Error(queryError.message);

    const events = eventsResult.data as EventRow[];
    const participants = participantsResult.data as ParticipantRow[];
    const resolvedAwards = (resolvedAwardsResult.data ?? []) as { event_id: number; award_type: AwardType; player_id: number }[];

    const eventById = new Map(events.map((e) => [e.id, e]));
    const byEvent = new Map<number, ParticipantRow[]>();
    for (const p of participants) {
      const list = byEvent.get(p.event_id);
      if (list) list.push(p);
      else byEvent.set(p.event_id, [p]);
    }

    // Games played/won count internal games (matches and whole tournaments);
    // external matches and trainings are tallied separately.
    const played = new Map<number, number>();
    const won = new Map<number, number>();
    const attended = new Map<number, number>();
    const coached = new Map<number, number>();
    const externalPlayed = new Map<number, number>();
    // The same pass that tallies the counters records which events produced
    // them, so a player's own history needs no second trip to the server.
    const eventIdsByPlayer = new Map<number, Set<number>>();
    const wonEventIdsByPlayer = new Map<number, Set<number>>();

    for (const p of participants) {
      const event = eventById.get(p.event_id);
      if (!event) continue;
      remember(eventIdsByPlayer, p.player_id, p.event_id);
      if (event.type === 'match' || event.type === 'tournament') {
        increment(played, p.player_id);
        if (event.winning_team_id != null && p.team_id === event.winning_team_id) {
          increment(won, p.player_id);
          remember(wonEventIdsByPlayer, p.player_id, p.event_id);
        }
      } else if (event.type === 'external_match') {
        increment(externalPlayed, p.player_id);
      } else if (event.type === 'training') {
        increment(p.kind === 'coach' ? coached : attended, p.player_id);
      }
    }

    // Awards per category — from the resolved-awards RPC which aggregates
    // historical resolutions + computed unambiguous winners from votes,
    // gated on closed voting windows.
    const perCategory = new Map<AwardType, Map<number, number>>();
    for (const award of AWARD_TYPES) {
      perCategory.set(award, new Map());
    }
    for (const row of resolvedAwards) {
      const counts = perCategory.get(row.award_type);
      if (counts) {
        counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
      }
    }

    // Per-event participant lists for the gender ratio. External matches are
    // excluded on purpose: their roster reflects the opponent matchup, not
    // the group's own turnout.
    const participantsByEvent: number[][] = [];
    for (const event of events) {
      if (event.type !== 'match' && event.type !== 'training' && event.type !== 'tournament') continue;
      const playerIds = (byEvent.get(event.id) ?? []).map((p) => p.player_id);
      if (playerIds.length > 0) {
        participantsByEvent.push(playerIds);
      }
    }

    return {
      gamesPlayed: played,
      gamesWon: won,
      awardCounts: perCategory,
      trainingsAttended: attended,
      trainingsCoached: coached,
      externalMatchesPlayed: externalPlayed,
      eventParticipants: participantsByEvent,
      eventIdsByPlayer,
      wonEventIdsByPlayer,
    };
  }, []);

  return {
    gamesPlayed: data?.gamesPlayed ?? EMPTY_COUNTS,
    gamesWon: data?.gamesWon ?? EMPTY_COUNTS,
    awardCounts: data?.awardCounts ?? EMPTY_AWARDS,
    trainingsAttended: data?.trainingsAttended ?? EMPTY_COUNTS,
    trainingsCoached: data?.trainingsCoached ?? EMPTY_COUNTS,
    externalMatchesPlayed: data?.externalMatchesPlayed ?? EMPTY_COUNTS,
    eventParticipants: data?.eventParticipants ?? EMPTY_EVENTS,
    eventIdsByPlayer: data?.eventIdsByPlayer ?? EMPTY_EVENT_IDS,
    wonEventIdsByPlayer: data?.wonEventIdsByPlayer ?? EMPTY_EVENT_IDS,
    loading,
    error,
  };
}

/** Returns the set of player IDs sharing the highest count in the given map. */
export function getLeaderIds(counts: Map<number, number>): Set<number> {
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }
  const leaders = new Set<number>();
  if (maxCount > 0) {
    for (const [playerId, count] of counts) {
      if (count === maxCount) leaders.add(playerId);
    }
  }
  return leaders;
}
