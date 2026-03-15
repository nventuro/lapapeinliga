import { useState, useEffect } from 'react';
import type { AwardType } from '../types';
import { AWARD_TYPES } from '../types';
import { supabase } from '../lib/supabase';

export interface MatchdayStats {
  gamesPlayed: Map<number, number>;
  gamesWon: Map<number, number>;
  awardCounts: Map<AwardType, Map<number, number>>;
  matchdayParticipants: number[][];
  loading: boolean;
  error: string | null;
}

export function useMatchdayStats(): MatchdayStats {
  const [gamesPlayed, setGamesPlayed] = useState<Map<number, number>>(new Map());
  const [gamesWon, setGamesWon] = useState<Map<number, number>>(new Map());
  const [awardCounts, setAwardCounts] = useState<Map<AwardType, Map<number, number>>>(new Map());
  const [matchdayParticipants, setMatchdayParticipants] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      const [matchdaysResult, teamsResult, teamPlayersResult, reservesResult] = await Promise.all([
        supabase.from('matchdays').select('*'),
        supabase.from('matchday_teams').select('id, matchday_id'),
        supabase.from('matchday_team_players').select('matchday_team_id, player_id'),
        supabase.from('matchday_reserves').select('matchday_id, player_id'),
      ]);

      const queryError = matchdaysResult.error || teamsResult.error || teamPlayersResult.error || reservesResult.error;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const matchdays = matchdaysResult.data!;
      const teams = teamsResult.data!;
      const teamPlayers = teamPlayersResult.data!;
      const reserves = reservesResult.data!;

      // Build team ID → matchday ID lookup
      const teamToMatchday = new Map<number, number>();
      for (const team of teams) {
        teamToMatchday.set(team.id, team.matchday_id);
      }

      // Games played: count from team players + reserves
      const played = new Map<number, number>();
      for (const tp of teamPlayers) {
        played.set(tp.player_id, (played.get(tp.player_id) ?? 0) + 1);
      }
      for (const r of reserves) {
        played.set(r.player_id, (played.get(r.player_id) ?? 0) + 1);
      }

      // Games won: for each matchday with a winner, find players on winning team
      const won = new Map<number, number>();
      for (const matchday of matchdays) {
        if (!matchday.winning_team_id) continue;
        const winningPlayers = teamPlayers.filter((tp) => tp.matchday_team_id === matchday.winning_team_id);
        for (const wp of winningPlayers) {
          won.set(wp.player_id, (won.get(wp.player_id) ?? 0) + 1);
        }
      }

      // Awards per category
      const perCategory = new Map<AwardType, Map<number, number>>();
      for (const award of AWARD_TYPES) {
        const counts = new Map<number, number>();
        for (const matchday of matchdays) {
          const playerId = matchday[`${award}_id`] as number | null;
          if (playerId) {
            counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
          }
        }
        perCategory.set(award, counts);
      }

      // Build per-matchday participant lists for gender ratio
      const participantsByMatchday: number[][] = [];
      for (const matchday of matchdays) {
        const matchdayTeamIds = new Set(
          teams.filter((t) => t.matchday_id === matchday.id).map((t) => t.id),
        );
        const playerIds = [
          ...teamPlayers.filter((tp) => matchdayTeamIds.has(tp.matchday_team_id)).map((tp) => tp.player_id),
          ...reserves.filter((r) => r.matchday_id === matchday.id).map((r) => r.player_id),
        ];
        if (playerIds.length > 0) {
          participantsByMatchday.push(playerIds);
        }
      }

      setGamesPlayed(played);
      setGamesWon(won);
      setAwardCounts(perCategory);
      setMatchdayParticipants(participantsByMatchday);
      setLoading(false);
    }
    fetchStats();
  }, []);

  return { gamesPlayed, gamesWon, awardCounts, matchdayParticipants, loading, error };
}

/** Returns the set of player IDs sharing the highest count in the given map. */
export function getLeaderIds(counts: Map<number, number>): Set<number> {
  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }
  const leaders = new Set<number>();
  if (maxCount > 0) {
    for (const [playerId, count] of counts) {
      if (count === maxCount) leaders.add(playerId);
    }
  }
  return leaders;
}
