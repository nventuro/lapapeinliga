import type { Player, Team } from '../types';

export interface SortResult {
  teams: Team[];
  reserves: Player[];
}

export function sortTeams(players: Player[], teamCount: number): SortResult {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const perTeam = Math.floor(players.length / teamCount);

  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    name: `Equipo ${String.fromCharCode(65 + i)}`,
    players: shuffled.slice(i * perTeam, (i + 1) * perTeam),
  }));

  const reserves = shuffled.slice(teamCount * perTeam);

  return { teams, reserves };
}

export function teamAverageRating(team: Team): number {
  if (team.players.length === 0) return 0;
  const sum = team.players.reduce((acc, p) => acc + p.rating, 0);
  return sum / team.players.length;
}
