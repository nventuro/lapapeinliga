import type { AwardType } from '../types';
import { AWARD_TYPES } from '../types';
import { supabase } from '../lib/supabase';
import { useSupabaseQuery } from './useSupabaseQuery';

export interface EventStats {
  gamesPlayed: Map<number, number>;
  gamesWon: Map<number, number>;
  awardCounts: Map<AwardType, Map<number, number>>;
  trainingsAttended: Map<number, number>;
  trainingsCoached: Map<number, number>;
  externalMatchesPlayed: Map<number, number>;
  eventParticipants: number[][];
  loading: boolean;
  error: string | null;
}

const EMPTY_COUNTS: Map<number, number> = new Map();
const EMPTY_AWARDS: Map<AwardType, Map<number, number>> = new Map();
const EMPTY_EVENTS: number[][] = [];

export function useEventStats(): EventStats {
  const { data, loading, error } = useSupabaseQuery(async () => {
    const [
      matchesResult, teamsResult, teamPlayersResult, reservesResult,
      trainingsResult, attendeesResult, coachesResult,
      tournamentsResult, tournamentTeamsResult, tournamentTeamPlayersResult, tournamentReservesResult,
      externalRosterResult, externalReservesResult,
      resolvedAwardsResult,
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
      supabase.from('external_match_players').select('player_id'),
      supabase.from('external_match_reserves').select('player_id'),
      supabase.rpc('get_resolved_event_awards'),
    ]);

    const queryError = matchesResult.error || teamsResult.error || teamPlayersResult.error
      || reservesResult.error || trainingsResult.error || attendeesResult.error || coachesResult.error
      || tournamentsResult.error || tournamentTeamsResult.error || tournamentTeamPlayersResult.error
      || tournamentReservesResult.error || externalRosterResult.error || externalReservesResult.error
      || resolvedAwardsResult.error;
    if (queryError) throw new Error(queryError.message);

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
    const externalRoster = externalRosterResult.data!;
    const externalReserves = externalReservesResult.data!;
    const resolvedAwards = (resolvedAwardsResult.data ?? []) as { event_id: number; award_type: AwardType; player_id: number }[];

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
      if (match.winning_team_id == null) continue;
      const winningPlayers = teamPlayers.filter((tp) => tp.match_team_id === match.winning_team_id);
      for (const wp of winningPlayers) {
        won.set(wp.player_id, (won.get(wp.player_id) ?? 0) + 1);
      }
    }

    // Awards per category — from the resolved-awards RPC which aggregates
    // historical resolutions + computed unambiguous winners from votes,
    // gated on closed voting windows.
    const perCategory = new Map<AwardType, Map<number, number>>();
    for (const award of AWARD_TYPES) {
      perCategory.set(award, new Map());
    }
    for (const row of resolvedAwards) {
      const counts = perCategory.get(row.award_type);
      if (counts) {
        counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
      }
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
      if (tournament.winning_team_id != null) {
        const winningPlayers = tournamentTeamPlayers
          .filter((ttp) => ttp.tournament_team_id === tournament.winning_team_id);
        for (const wp of winningPlayers) {
          won.set(wp.player_id, (won.get(wp.player_id) ?? 0) + 1);
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

    // External matches played: counted separately from internal games.
    // Both the roster and the reserves count as an appearance.
    const externalPlayed = new Map<number, number>();
    for (const r of externalRoster) {
      externalPlayed.set(r.player_id, (externalPlayed.get(r.player_id) ?? 0) + 1);
    }
    for (const r of externalReserves) {
      externalPlayed.set(r.player_id, (externalPlayed.get(r.player_id) ?? 0) + 1);
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

    return {
      gamesPlayed: played,
      gamesWon: won,
      awardCounts: perCategory,
      trainingsAttended: attended,
      trainingsCoached: coached,
      externalMatchesPlayed: externalPlayed,
      eventParticipants: participantsByEvent,
    };
  }, []);

  return {
    gamesPlayed: data?.gamesPlayed ?? EMPTY_COUNTS,
    gamesWon: data?.gamesWon ?? EMPTY_COUNTS,
    awardCounts: data?.awardCounts ?? EMPTY_AWARDS,
    trainingsAttended: data?.trainingsAttended ?? EMPTY_COUNTS,
    trainingsCoached: data?.trainingsCoached ?? EMPTY_COUNTS,
    externalMatchesPlayed: data?.externalMatchesPlayed ?? EMPTY_COUNTS,
    eventParticipants: data?.eventParticipants ?? EMPTY_EVENTS,
    loading,
    error,
  };
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
