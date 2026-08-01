import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseSupabaseQueryOptions {
  /** When false the query is held: data null, loading false, nothing fetched. */
  enabled?: boolean;
}

/**
 * Shared scaffolding for one-shot Supabase fetches, replacing the hand-rolled
 * `let cancelled` / loading / error boilerplate that used to be copy-pasted
 * across every hook and page — each copy with its own subtle gaps (loading
 * never resetting on dep change, errors never clearing on success, missing
 * cancellation).
 *
 * Guarantees:
 * - `fetchFn` re-runs whenever `deps` change; stale responses are discarded,
 *   so an older in-flight request can never clobber a newer one.
 * - `loading` is true from the moment a fetch starts until it settles, and
 *   resets to true on every dep change.
 * - `error` (the thrown Error's message) clears on the next successful fetch.
 * - Previous `data` is kept while a refetch is in flight (no flicker).
 * - `refetch()` re-runs with the current deps.
 *
 * `fetchFn` should unwrap the Supabase response and `throw new Error(...)` on
 * failure. The latest `fetchFn` is tracked in a ref, so inline closures are
 * fine and only `deps` control re-fetching.
 */
export function useSupabaseQuery<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[],
  options: UseSupabaseQueryOptions = {},
): QueryState<T> & { refetch: () => void } {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: enabled, error: null });
  const [fetchCount, bumpFetchCount] = useReducer((c: number) => c + 1, 0);

  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });

  // Previous data is only meaningful while the query key is the same: keep it
  // through a refetch() (no flicker), drop it when deps change (never show
  // one key's data under another key's loading state).
  const prevDepsRef = useRef<unknown[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      prevDepsRef.current = null;
      setState({ data: null, loading: false, error: null });
      return;
    }

    const prev = prevDepsRef.current;
    const depsChanged = prev === null || deps.length !== prev.length || deps.some((d, i) => d !== prev[i]);
    prevDepsRef.current = deps;

    let cancelled = false;
    setState((s) => ({ data: depsChanged ? null : s.data, loading: true, error: null }));

    fetchFnRef.current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setState((prev) => ({ ...prev, loading: false, error: message }));
        }
      });

    return () => {
      cancelled = true;
    };
    // The caller's deps array drives re-fetching by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, fetchCount]);

  const refetch = useCallback(() => bumpFetchCount(), []);

  return useMemo(() => ({ ...state, refetch }), [state, refetch]);
}
