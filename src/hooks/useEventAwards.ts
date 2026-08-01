import { useCallback } from 'react';
import type { AwardResult, AwardResultState, AwardType, AwardVoteWindowState, EventAwardWindow, EventType } from '../types';
import { hasAwards } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

interface UseEventAwardsResult {
  voteWindow: EventAwardWindow | null;
  results: AwardResult[];
  myVotes: Map<AwardType, number>;
  loading: boolean;
  error: string | null;
  castVote: (award: AwardType, candidateId: number) => Promise<void>;
  clearVote: (award: AwardType) => Promise<void>;
  resolveTie: (award: AwardType, chosenId: number) => Promise<void>;
}

type WindowRow = { state: AwardVoteWindowState; opens_at: string | null; closes_at: string | null; voter_count: number };
type ResultRow = { award_type: AwardType; state: AwardResultState; winner_id: number | null; tied_candidates: number[] | null };
type MyVoteRow = { award_type: AwardType; candidate_player_id: number };

const NA_WINDOW: EventAwardWindow = { state: 'n/a', opens_at: null, closes_at: null, voter_count: 0 };
const NO_VOTES: Map<AwardType, number> = new Map();

export function useEventAwards(eventId: number | null, eventType: EventType | null): UseEventAwardsResult {
  const enabled = eventId != null && eventType != null && hasAwards(eventType);

  const { data, loading, error, refetch } = useSupabaseQuery(async () => {
    const [windowRes, resultsRes, myVotesRes] = await Promise.all([
      supabase.rpc('get_event_award_window', { p_event_id: eventId }),
      supabase.rpc('get_event_award_results', { p_event_id: eventId }),
      supabase.rpc('get_my_event_award_votes', { p_event_id: eventId }),
    ]);

    const firstError = windowRes.error ?? resultsRes.error ?? myVotesRes.error;
    if (firstError) throw new Error(firstError.message);

    const windowRow = (windowRes.data as WindowRow[] | null)?.[0] ?? null;

    const results = ((resultsRes.data as ResultRow[] | null) ?? []).map((row) => ({
      award_type: row.award_type,
      state: row.state,
      winner_id: row.winner_id,
      tied_candidates: row.tied_candidates,
    }));

    const myVotes = new Map<AwardType, number>();
    for (const row of (myVotesRes.data as MyVoteRow[] | null) ?? []) {
      myVotes.set(row.award_type, row.candidate_player_id);
    }

    return { voteWindow: windowRow ?? NA_WINDOW, results, myVotes };
  }, [eventId], { enabled });

  const castVote = useCallback(async (award: AwardType, candidateId: number) => {
    const { error: rpcError } = await supabase.rpc('cast_award_vote', {
      p_event_id: eventId,
      p_award_type: award,
      p_candidate_id: candidateId,
    });
    if (rpcError) throw new Error(rpcError.message);
    refetch();
  }, [eventId, refetch]);

  const clearVote = useCallback(async (award: AwardType) => {
    const { error: rpcError } = await supabase.rpc('clear_award_vote', {
      p_event_id: eventId,
      p_award_type: award,
    });
    if (rpcError) throw new Error(rpcError.message);
    refetch();
  }, [eventId, refetch]);

  const resolveTie = useCallback(async (award: AwardType, chosenId: number) => {
    const { error: rpcError } = await supabase.rpc('resolve_event_award_tie', {
      p_event_id: eventId,
      p_award_type: award,
      p_chosen_id: chosenId,
    });
    if (rpcError) throw new Error(rpcError.message);
    refetch();
  }, [eventId, refetch]);

  return {
    // Types without awards report a permanent n/a window instead of fetching.
    voteWindow: enabled ? (data?.voteWindow ?? null) : NA_WINDOW,
    results: data?.results ?? [],
    myVotes: data?.myVotes ?? NO_VOTES,
    loading,
    error,
    castVote,
    clearVote,
    resolveTie,
  };
}
