import { useState, useEffect } from 'react';
import type { AwardType } from '../types';
import { AWARD_TYPES } from '../types';
import { supabase } from '../lib/supabase';

export interface EventStats {
  gamesPlayed: Map<number, number>;
  gamesWon: Map<number, number>;
  awardCounts: Map<AwardType, Map<number, number>>;
  trainingsAttended: Map<number, number>;
  trainingsCoached: Map<number, number>;
  eventParticipants: number[][];
  loading: boolean;
  error: string | null;
}

export function useEventStats(): EventStats {
  const [gamesPlayed, setGamesPlayed] = useState<Map<number, number>>(new Map());
  const [gamesWon, setGamesWon] = useState<Map<number, number>>(new Map());
  const [awardCounts, setAwardCounts] = useState<Map<AwardType, Map<number, number>>>(new Map());
  const [trainingsAttended, setTrainingsAttended] = useState<Map<number, number>>(new Map());
  const [trainingsCoached, setTrainingsCoached] = useState<Map<number, number>>(new Map());
  const [eventParticipants, setEventParticipants] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      const [
        matchesResult, teamsResult, teamPlayersResult, reservesResult,
        trainingsResult, attendeesResult, coachesResult,
      ] = await Promise.all([
        supabase.from('matches').select('*'),
        supabase.from('match_teams').select('id, match_id'),
        supabase.from('match_team_players').select('match_team_id, player_id'),
        supabase.from('match_reserves').select('match_id, player_id'),
        supabase.from('trainings').select('id'),
        supabase.from('training_attendees').select('training_id, player_id'),
        supabase.from('training_coaches').select('training_id, player_id'),
      ]);

      const queryError = matchesResult.error || teamsResult.error || teamPlayersResult.error
        || reservesResult.error || trainingsResult.error || attendeesResult.error || coachesResult.error;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      const matches = matchesResult.data!;
      const teams = teamsResult.data!;
      const teamPlayers = teamPlayersResult.data!;
      const reserves = reservesResult.data!;
      const trainings = trainingsResult.data!;
      const attendees = attendeesResult.data!;
      const coaches = coachesResult.data!;

      // Build team ID → match ID lookup
      const teamToMatch = new Map<number, number>();
      for (const team of teams) {
        teamToMatch.set(team.id, team.match_id);
      }

      // Games played: count from team players + reserves
      const played = new Map<number, number>();
      for (const tp of teamPlayers) {
        played.set(tp.player_id, (played.get(tp.player_id) ?? 0) + 1);
      }
      for (const r of reserves) {
        played.set(r.player_id, (played.get(r.player_id) ?? 0) + 1);
      }

      // Games won: for each match with a winner, find players on winning team
      const won = new Map<number, number>();
      for (const match of matches) {
        if (!match.winning_team_id) continue;
        const winningPlayers = teamPlayers.filter((tp) => tp.match_team_id === match.winning_team_id);
        for (const wp of winningPlayers) {
          won.set(wp.player_id, (won.get(wp.player_id) ?? 0) + 1);
        }
      }

      // Awards per category
      const perCategory = new Map<AwardType, Map<number, number>>();
      for (const award of AWARD_TYPES) {
        const counts = new Map<number, number>();
        for (const match of matches) {
          const playerId = match[`${award}_id`] as number | null;
          if (playerId) {
            counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
          }
        }
        perCategory.set(award, counts);
      }

      // Trainings attended
      const attended = new Map<number, number>();
      for (const a of attendees) {
        attended.set(a.player_id, (attended.get(a.player_id) ?? 0) + 1);
      }

      // Trainings coached
      const coached = new Map<number, number>();
      for (const c of coaches) {
        coached.set(c.player_id, (coached.get(c.player_id) ?? 0) + 1);
      }

      // Build per-event participant lists for gender ratio
      const participantsByEvent: number[][] = [];

      // Match participants
      for (const match of matches) {
        const matchTeamIds = new Set(
          teams.filter((t) => t.match_id === match.id).map((t) => t.id),
        );
        const playerIds = [
          ...teamPlayers.filter((tp) => matchTeamIds.has(tp.match_team_id)).map((tp) => tp.player_id),
          ...reserves.filter((r) => r.match_id === match.id).map((r) => r.player_id),
        ];
        if (playerIds.length > 0) {
          participantsByEvent.push(playerIds);
        }
      }

      // Training participants (attendees + coaches)
      for (const training of trainings) {
        const playerIds = [
          ...attendees.filter((a) => a.training_id === training.id).map((a) => a.player_id),
          ...coaches.filter((c) => c.training_id === training.id).map((c) => c.player_id),
        ];
        if (playerIds.length > 0) {
          participantsByEvent.push(playerIds);
        }
      }

      setGamesPlayed(played);
      setGamesWon(won);
      setAwardCounts(perCategory);
      setTrainingsAttended(attended);
      setTrainingsCoached(coached);
      setEventParticipants(participantsByEvent);
      setLoading(false);
    }
    fetchStats();
  }, []);

  return { gamesPlayed, gamesWon, awardCounts, trainingsAttended, trainingsCoached, eventParticipants, loading, error };
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
