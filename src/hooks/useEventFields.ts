import { useState } from 'react';
import type { Location, LocationSelection } from '../types';
import { supabase } from '../lib/supabase';

/** The state bundle behind the shared event fields (EventFieldsForm). */
export interface EventFieldsState {
  name: string;
  setName: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
  locationSelection: LocationSelection;
  setLocationSelection: (v: LocationSelection) => void;
  cost: string;
  setCost: (v: string) => void;
  payee: string;
  setPayee: (v: string) => void;
}

export function useEventFieldsState(initial: {
  name?: string;
  date?: string;
  time?: string;
  locationSelection?: LocationSelection;
  cost?: string;
  payee?: string;
} = {}): EventFieldsState {
  const [name, setName] = useState(initial.name ?? '');
  const [date, setDate] = useState(initial.date ?? '');
  const [time, setTime] = useState(initial.time ?? '');
  const [locationSelection, setLocationSelection] = useState<LocationSelection>(
    initial.locationSelection ?? { type: 'none' },
  );
  const [cost, setCost] = useState(initial.cost ?? '');
  const [payee, setPayee] = useState(initial.payee ?? '');

  return { name, setName, date, setDate, time, setTime, locationSelection, setLocationSelection, cost, setCost, payee, setPayee };
}

/**
 * Resolves a location selection into a location id, inserting the new venue
 * when needed. Shared by the save dialog and the detail-page editor so the
 * "create a new location" flow exists exactly once.
 */
export async function resolveLocationSelection(
  selection: LocationSelection,
): Promise<{ locationId: number | null; created: Location | null } | { error: string }> {
  if (selection.type === 'none') return { locationId: null, created: null };
  if (selection.type === 'existing') return { locationId: selection.locationId, created: null };

  if (!selection.name.trim() || !selection.mapsUrl.trim()) {
    return { error: 'Completá el nombre y el link de Google Maps de la cancha.' };
  }
  const { data, error } = await supabase
    .from('locations')
    .insert({ name: selection.name.trim(), maps_url: selection.mapsUrl.trim() })
    .select('*')
    .single();
  if (error || !data) return { error: error?.message ?? 'Error al crear la cancha.' };
  const created = data as Location;
  return { locationId: created.id, created };
}
