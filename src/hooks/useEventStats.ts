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
        tournamentsResult, tournamentTeamsResult, tournamentTeamPlayersResult, tournamentReservesResult,
      ] = await Promise.all([
        supabase.from('matches').select('*'),
        supabase.from('match_teams').select('id, match_id'),
        supabase.from('match_team_players').select('match_team_id, player_id'),
        supabase.from('match_reserves').select('match_id, player_id'),
        supabase.from('trainings').select('id'),
        supabase.from('training_attendees').select('training_id, player_id'),
        supabase.from('training_coaches').select('training_id, player_id'),
        supabase.from('tournaments').select('*'),
        supabase.from('tournament_teams').select('id, tournament_id'),
        supabase.from('tournament_team_players').select('tournament_team_id, player_id'),
        supabase.from('tournament_reserves').select('tournament_id, player_id'),
      ]);

      const queryError = matchesResult.error || teamsResult.error || teamPlayersResult.error
        || reservesResult.error || trainingsResult.error || attendeesResult.error || coachesResult.error
        || tournamentsResult.error || tournamentTeamsResult.error || tournamentTeamPlayersResult.error
        || tournamentReservesResult.error;
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
      const tournaments = tournamentsResult.data!;
      const tournamentTeams = tournamentTeamsResult.data!;
      const tournamentTeamPlayers = tournamentTeamPlayersResult.data!;
      const tournamentReserves = tournamentReservesResult.data!;

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

      // Tournament team ID → tournament ID lookup
      const tournamentTeamToTournament = new Map<number, number>();
      for (const tt of tournamentTeams) {
        tournamentTeamToTournament.set(tt.id, tt.tournament_id);
      }

      // Tournaments: whole tournament = 1 game played per participant
      for (const tournament of tournaments) {
        const tournamentTeamIds = new Set(
          tournamentTeams.filter((tt) => tt.tournament_id === tournament.id).map((tt) => tt.id),
        );
        // All team players in this tournament
        const teamPlayerIds = tournamentTeamPlayers
          .filter((ttp) => tournamentTeamIds.has(ttp.tournament_team_id))
          .map((ttp) => ttp.player_id);
        // All reserves in this tournament
        const reservePlayerIds = tournamentReserves
          .filter((tr) => tr.tournament_id === tournament.id)
          .map((tr) => tr.player_id);

        const allPlayerIds = [...teamPlayerIds, ...reservePlayerIds];
        for (const pid of allPlayerIds) {
          played.set(pid, (played.get(pid) ?? 0) + 1);
        }

        // Games won: players on the winning team
        if (tournament.winning_team_id) {
          const winningPlayers = tournamentTeamPlayers
            .filter((ttp) => ttp.tournament_team_id === tournament.winning_team_id);
          for (const wp of winningPlayers) {
            won.set(wp.player_id, (won.get(wp.player_id) ?? 0) + 1);
          }
        }

        // Awards
        for (const award of AWARD_TYPES) {
          const playerId = tournament[`${award}_id`] as number | null;
          if (playerId) {
            const counts = perCategory.get(award)!;
            counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
          }
        }
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

      // Tournament participants
      for (const tournament of tournaments) {
        const tournamentTeamIds = new Set(
          tournamentTeams.filter((tt) => tt.tournament_id === tournament.id).map((tt) => tt.id),
        );
        const playerIds = [
          ...tournamentTeamPlayers.filter((ttp) => tournamentTeamIds.has(ttp.tournament_team_id)).map((ttp) => ttp.player_id),
          ...tournamentReserves.filter((tr) => tr.tournament_id === tournament.id).map((tr) => tr.player_id),
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
