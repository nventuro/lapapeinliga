import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Apply the canonical matchday ordering (played_at → played_at_time → id). */
export function orderMatchdays<T>(query: { order: (column: string, opts: { ascending: boolean }) => T }, ascending: boolean): T {
  return query
    .order('played_at', { ascending })
    .order('played_at_time', { ascending })
    .order('id', { ascending });
}
