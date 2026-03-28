import type { TournamentMatch, TournamentTeam } from '../types';
import { TOURNAMENT_WIN_POINTS, TOURNAMENT_DRAW_POINTS } from '../types';

export interface TeamStanding {
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export function computeStandings(
  teams: TournamentTeam[],
  matches: TournamentMatch[],
): TeamStanding[] {
  const standingMap = new Map<number, TeamStanding>();

  for (const team of teams) {
    standingMap.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.score_a === null || match.score_b === null) continue;

    const standingA = standingMap.get(match.team_a_id);
    const standingB = standingMap.get(match.team_b_id);
    if (!standingA || !standingB) continue;

    standingA.played++;
    standingB.played++;
    standingA.goalsFor += match.score_a;
    standingA.goalsAgainst += match.score_b;
    standingB.goalsFor += match.score_b;
    standingB.goalsAgainst += match.score_a;

    if (match.score_a > match.score_b) {
      standingA.won++;
      standingA.points += TOURNAMENT_WIN_POINTS;
      standingB.lost++;
    } else if (match.score_b > match.score_a) {
      standingB.won++;
      standingB.points += TOURNAMENT_WIN_POINTS;
      standingA.lost++;
    } else {
      standingA.drawn++;
      standingA.points += TOURNAMENT_DRAW_POINTS;
      standingB.drawn++;
      standingB.points += TOURNAMENT_DRAW_POINTS;
    }
  }

  const standings = Array.from(standingMap.values());
  standings.sort((a, b) => b.points - a.points || b.goalsFor - a.goalsFor);
  return standings;
}
