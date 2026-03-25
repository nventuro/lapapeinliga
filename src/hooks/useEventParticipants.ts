import { useState, useEffect } from 'react';
import type { Player } from '../types';
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
 */
export function useEventParticipants(eventId: number | null): { participants: Player[]; loading: boolean } {
  const { players } = useAppContext();
  const [fetchedData, setFetchedData] = useState<FetchedParticipants | null>(null);

  useEffect(() => {
    if (eventId === null) return;

    let cancelled = false;

    async function fetchParticipants() {
      const { data, error } = await supabase
        .from('event_participants')
        .select('player_id')
        .eq('event_id', eventId);

      if (cancelled) return;

      const ids = error || !data
        ? new Set<number>()
        : new Set(data.map((row: { player_id: number }) => row.player_id));

      setFetchedData({ forEventId: eventId!, ids });
    }

    fetchParticipants();
    return () => { cancelled = true; };
  }, [eventId]);

  // Derive loading from whether fetched data matches current eventId
  const loading = eventId !== null && fetchedData?.forEventId !== eventId;

  const participants = eventId === null
    ? players
    : (!loading && fetchedData ? players.filter((p) => fetchedData.ids.has(p.id)) : []);

  return {
    participants: participants.sort((a, b) => a.name.localeCompare(b.name)),
    loading,
  };
}
