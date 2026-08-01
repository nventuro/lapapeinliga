import { useMemo } from 'react';
import type { EventType, Player } from '../types';
import { compareByName, hasParticipantList } from '../types';
import { useAppContext } from '../context/appContext';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

/**
 * Returns the list of players eligible for tagging on a given event.
 * - If eventId is set: only players who participated in that event (via event_participants view).
 * - If eventId is null: all players (no attendance constraint).
 * - If the event's type keeps no participant list (social events): all players,
 *   since there is no attendance to constrain by.
 */
export function useEventParticipants(eventId: number | null, eventType: EventType | null): { participants: Player[]; loading: boolean } {
  const { players } = useAppContext();

  // Null while the event imposes no attendance constraint, which also skips the fetch.
  const rosterEventId = eventId !== null && (eventType === null || hasParticipantList(eventType))
    ? eventId
    : null;

  const { data: participantIds, loading } = useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('event_participants')
      .select('player_id')
      .eq('event_id', rosterEventId!);
    if (error) throw new Error(error.message);
    return new Set(data.map((row: { player_id: number }) => row.player_id));
  }, [rosterEventId], { enabled: rosterEventId !== null });

  const participants = useMemo(() => {
    // Copy before sorting: in the unconstrained case the base IS the shared
    // context players array, and sorting it in place would mutate shared state.
    const base = rosterEventId === null
      ? players
      : participantIds
        ? players.filter((p) => participantIds.has(p.id))
        : [];
    return [...base].sort(compareByName);
  }, [rosterEventId, players, participantIds]);

  return { participants, loading };
}
