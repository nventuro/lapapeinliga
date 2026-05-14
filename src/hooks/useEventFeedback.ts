import { useCallback, useEffect, useState } from 'react';
import type { AwardVoteWindowState, EventType } from '../types';
import { supabase } from '../lib/supabase';

interface UseEventFeedbackResult {
  myBody: string | null;
  adminBodies: string[] | null;
  loading: boolean;
  error: string | null;
  submit: (body: string) => Promise<void>;
  clear: () => Promise<void>;
}

type BodyRow = { body: string };

export function useEventFeedback(
  eventId: number | null,
  eventType: EventType | null,
  windowState: AwardVoteWindowState | null,
  isAdmin: boolean,
): UseEventFeedbackResult {
  const [myBody, setMyBody] = useState<string | null>(null);
  const [adminBodies, setAdminBodies] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      if (eventId == null || eventType == null || eventType === 'training' || windowState == null || windowState === 'n/a') {
        if (cancelled) return;
        setMyBody(null);
        setAdminBodies(null);
        setLoading(false);
        return;
      }

      if (windowState === 'open') {
        const { data, error: rpcError } = await supabase.rpc('get_my_event_feedback', { p_event_id: eventId });
        if (cancelled) return;
        if (rpcError) {
          setError(rpcError.message);
          setLoading(false);
          return;
        }
        const rows = (data as BodyRow[] | null) ?? [];
        setMyBody(rows[0]?.body ?? null);
        setAdminBodies(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (windowState === 'closed' && isAdmin) {
        const { data, error: rpcError } = await supabase.rpc('get_event_feedback_admin', { p_event_id: eventId });
        if (cancelled) return;
        if (rpcError) {
          setError(rpcError.message);
          setLoading(false);
          return;
        }
        const rows = (data as BodyRow[] | null) ?? [];
        setAdminBodies(rows.map((r) => r.body));
        setMyBody(null);
        setError(null);
        setLoading(false);
        return;
      }

      // pending, or closed-non-admin: nothing to load.
      setMyBody(null);
      setAdminBodies(null);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [eventId, eventType, windowState, isAdmin, refreshKey]);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const submit = useCallback(async (body: string) => {
    const { error: rpcError } = await supabase.rpc('submit_event_feedback', {
      p_event_id: eventId,
      p_body: body,
    });
    if (rpcError) throw new Error(rpcError.message);
    triggerRefresh();
  }, [eventId, triggerRefresh]);

  const clear = useCallback(async () => {
    const { error: rpcError } = await supabase.rpc('clear_event_feedback', { p_event_id: eventId });
    if (rpcError) throw new Error(rpcError.message);
    triggerRefresh();
  }, [eventId, triggerRefresh]);

  return { myBody, adminBodies, loading, error, submit, clear };
}
