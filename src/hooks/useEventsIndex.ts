import { useMemo } from 'react';
import type { EventType } from '../types';
import { supabase, orderEvents, buildEventLabels } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

/** The lightweight per-event row served by the all-events index. */
export interface EventIndexRow {
  id: number;
  short_id: string;
  name: string | null;
  type: EventType;
  played_at: string;
  played_at_time: string;
}

interface UseEventsIndexResult {
  /** All events, ascending by the canonical ordering (oldest first). */
  events: EventIndexRow[];
  /** Display label per event id ("3", "3a", ...). */
  labels: Map<number, string>;
  loading: boolean;
  error: string | null;
}

/**
 * The all-events index used to resolve event labels and populate event
 * dropdowns. Single replacement for the four independent copies of
 * "fetch every event + buildEventLabels" that used to live in the gallery,
 * upload dialog, event list and event detail page.
 */
export function useEventsIndex(): UseEventsIndexResult {
  const { data, loading, error } = useSupabaseQuery(async () => {
    const { data, error } = await orderEvents(
      supabase.from('events').select('id, short_id, name, type, played_at, played_at_time'),
      true,
    );
    if (error) throw new Error(error.message);
    return data as EventIndexRow[];
  }, []);

  const events = useMemo(() => data ?? [], [data]);
  const labels = useMemo(() => buildEventLabels(events), [events]);

  return { events, labels, loading, error };
}
