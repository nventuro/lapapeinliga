import { useState, useEffect } from 'react';
import type { EventType, Player } from '../types';
import { hasParticipantList } from '../types';
import { useAppContext } from '../context/appContext';
import { supabase } from '../lib/supabase';

interface FetchedParticipants {
  forEventId: number;
  ids: Set<number>;
}

/**
 * Returns the list of players eligible for tagging on a given event.
 * - If eventId is set: only players who participated in that event (via event_participants view).
 * - If eventId is null: all players (no attendance constraint).
 * - If the event's type keeps no participant list (social events): all players,
 *   since there is no attendance to constrain by.
 */
export function useEventParticipants(eventId: number | null, eventType: EventType | null): { participants: Player[]; loading: boolean } {
  const { players } = useAppContext();
  const [fetchedData, setFetchedData] = useState<FetchedParticipants | null>(null);

  // Null while the event imposes no attendance constraint, which also skips the fetch.
  const rosterEventId = eventId !== null && (eventType === null || hasParticipantList(eventType))
    ? eventId
    : null;

  useEffect(() => {
    if (rosterEventId === null) return;

    let cancelled = false;

    async function fetchParticipants() {
      const { data, error } = await supabase
        .from('event_participants')
        .select('player_id')
        .eq('event_id', rosterEventId);

      if (cancelled) return;

      const ids = error || !data
        ? new Set<number>()
        : new Set(data.map((row: { player_id: number }) => row.player_id));

      setFetchedData({ forEventId: rosterEventId!, ids });
    }

    fetchParticipants();
    return () => { cancelled = true; };
  }, [rosterEventId]);

  // Derive loading from whether fetched data matches current eventId
  const loading = rosterEventId !== null && fetchedData?.forEventId !== rosterEventId;

  const participants = rosterEventId === null
    ? players
    : (!loading && fetchedData ? players.filter((p) => fetchedData.ids.has(p.id)) : []);

  return {
    // Copy before sorting: in the unconstrained case `participants` IS the
    // context players array, and sorting it in place would mutate shared state.
    participants: [...participants].sort((a, b) => a.name.localeCompare(b.name)),
    loading,
  };
}
