import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Apply the canonical event ordering (played_at → played_at_time → id). */
export function orderEvents<T extends { order: (column: string, opts: { ascending: boolean }) => T }>(query: T, ascending: boolean): T {
  return query
    .order('played_at', { ascending })
    .order('played_at_time', { ascending })
    .order('id', { ascending });
}

/**
 * Build a label for each event based on chronological date order.
 * Events on the same date share a number and get a letter suffix (e.g. "3a", "3b").
 * Rows must be sorted ascending by the canonical ordering.
 */
export function buildEventLabels(rows: { id: number; played_at: string }[]): Map<number, string> {
  const labels = new Map<number, string>();

  let dateNumber = 0;
  let i = 0;
  while (i < rows.length) {
    // Find all rows sharing this date
    const date = rows[i].played_at;
    let j = i;
    while (j < rows.length && rows[j].played_at === date) j++;

    dateNumber++;
    const groupSize = j - i;
    for (let k = i; k < j; k++) {
      const suffix = groupSize > 1 ? String.fromCharCode(97 + k - i) : '';
      labels.set(rows[k].id, `${dateNumber}${suffix}`);
    }
    i = j;
  }

  return labels;
}
