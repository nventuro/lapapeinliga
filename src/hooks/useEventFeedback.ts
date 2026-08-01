import { useCallback } from 'react';
import type { AwardVoteWindowState, EventType } from '../types';
import { hasAwards } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

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
  const applicable = eventId != null && eventType != null && hasAwards(eventType)
    && windowState != null && windowState !== 'n/a';
  // While open, everyone can see (and edit) their own feedback; once closed,
  // admins see all of it. In every other state there is nothing to load.
  const enabled = applicable && (windowState === 'open' || (windowState === 'closed' && isAdmin));

  const { data, loading, error, refetch } = useSupabaseQuery(async () => {
    if (windowState === 'open') {
      const { data, error: rpcError } = await supabase.rpc('get_my_event_feedback', { p_event_id: eventId });
      if (rpcError) throw new Error(rpcError.message);
      const rows = (data as BodyRow[] | null) ?? [];
      return { myBody: rows[0]?.body ?? null, adminBodies: null as string[] | null };
    }

    const { data, error: rpcError } = await supabase.rpc('get_event_feedback_admin', { p_event_id: eventId });
    if (rpcError) throw new Error(rpcError.message);
    const rows = (data as BodyRow[] | null) ?? [];
    return { myBody: null, adminBodies: rows.map((r) => r.body) };
  }, [eventId, windowState, isAdmin], { enabled });

  const submit = useCallback(async (body: string) => {
    const { error: rpcError } = await supabase.rpc('submit_event_feedback', {
      p_event_id: eventId,
      p_body: body,
    });
    if (rpcError) throw new Error(rpcError.message);
    refetch();
  }, [eventId, refetch]);

  const clear = useCallback(async () => {
    const { error: rpcError } = await supabase.rpc('clear_event_feedback', { p_event_id: eventId });
    if (rpcError) throw new Error(rpcError.message);
    refetch();
  }, [eventId, refetch]);

  return {
    myBody: data?.myBody ?? null,
    adminBodies: data?.adminBodies ?? null,
    loading,
    error,
    submit,
    clear,
  };
}
