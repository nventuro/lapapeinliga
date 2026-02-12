import type { Player, Team } from '../types';

const TEAM_NAMES = [
  'Equipo A',
  'Equipo B',
  'Equipo C',
  'Equipo D',
  'Equipo E',
  'Equipo F',
];

export function sortTeams(players: Player[], teamCount: number): Team[] {
  const shuffled = [...players].sort(() => Math.random() - 0.5);

  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    name: TEAM_NAMES[i] ?? `Equipo ${i + 1}`,
    players: [],
  }));

  shuffled.forEach((player, index) => {
    teams[index % teamCount].players.push(player);
  });

  return teams;
}

export function teamAverageRating(team: Team): number {
  if (team.players.length === 0) return 0;
  const sum = team.players.reduce((acc, p) => acc + p.rating, 0);
  return sum / team.players.length;
}
