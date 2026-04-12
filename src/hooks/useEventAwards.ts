import { useState, useEffect, useCallback } from 'react';
import type { AwardResult, AwardResultState, AwardType, AwardVoteWindowState, EventAwardWindow, EventType } from '../types';
import { supabase } from '../lib/supabase';

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

export function useEventAwards(eventId: number | null, eventType: EventType | null): UseEventAwardsResult {
  const [voteWindow, setVoteWindow] = useState<EventAwardWindow | null>(null);
  const [results, setResults] = useState<AwardResult[]>([]);
  const [myVotes, setMyVotes] = useState<Map<AwardType, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      if (eventId == null || eventType == null || eventType === 'training') {
        if (cancelled) return;
        setVoteWindow({ state: 'n/a', opens_at: null, closes_at: null, voter_count: 0 });
        setResults([]);
        setMyVotes(new Map());
        setLoading(false);
        return;
      }

      const [windowRes, resultsRes, myVotesRes] = await Promise.all([
        supabase.rpc('get_event_award_window', { p_event_id: eventId }),
        supabase.rpc('get_event_award_results', { p_event_id: eventId }),
        supabase.rpc('get_my_event_award_votes', { p_event_id: eventId }),
      ]);

      if (cancelled) return;

      const firstError = windowRes.error ?? resultsRes.error ?? myVotesRes.error;
      if (firstError) {
        setError(firstError.message);
        setLoading(false);
        return;
      }

      const windowRow = (windowRes.data as WindowRow[] | null)?.[0] ?? null;
      setVoteWindow(windowRow ?? { state: 'n/a', opens_at: null, closes_at: null, voter_count: 0 });

      const resultRows = (resultsRes.data as ResultRow[] | null) ?? [];
      setResults(resultRows.map((row) => ({
        award_type: row.award_type,
        state: row.state,
        winner_id: row.winner_id,
        tied_candidates: row.tied_candidates,
      })));

      const votesMap = new Map<AwardType, number>();
      for (const row of (myVotesRes.data as MyVoteRow[] | null) ?? []) {
        votesMap.set(row.award_type, row.candidate_player_id);
      }
      setMyVotes(votesMap);

      setError(null);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [eventId, eventType, refreshKey]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const castVote = useCallback(async (award: AwardType, candidateId: number) => {
    const { error: rpcError } = await supabase.rpc('cast_award_vote', {
      p_event_id: eventId,
      p_award_type: award,
      p_candidate_id: candidateId,
    });
    if (rpcError) throw new Error(rpcError.message);
    triggerRefresh();
  }, [eventId, triggerRefresh]);

  const clearVote = useCallback(async (award: AwardType) => {
    const { error: rpcError } = await supabase.rpc('clear_award_vote', {
      p_event_id: eventId,
      p_award_type: award,
    });
    if (rpcError) throw new Error(rpcError.message);
    triggerRefresh();
  }, [eventId, triggerRefresh]);

  const resolveTie = useCallback(async (award: AwardType, chosenId: number) => {
    const { error: rpcError } = await supabase.rpc('resolve_event_award_tie', {
      p_event_id: eventId,
      p_award_type: award,
      p_chosen_id: chosenId,
    });
    if (rpcError) throw new Error(rpcError.message);
    triggerRefresh();
  }, [eventId, triggerRefresh]);

  return { voteWindow, results, myVotes, loading, error, castVote, clearVote, resolveTie };
}
