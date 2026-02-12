import { MIN_TEAM_SIZE, MAX_TEAM_SIZE, MIN_TEAMS } from '../types';

export interface TeamOption {
  teamCount: number;
  playersPerTeam: number;
  reserves: number;
}

export function getValidTeamCounts(playerCount: number): TeamOption[] {
  const options: TeamOption[] = [];

  for (let t = MIN_TEAMS; t <= playerCount; t++) {
    // Cap team size to MAX_TEAM_SIZE — excess players become reserves
    const perTeam = Math.min(Math.floor(playerCount / t), MAX_TEAM_SIZE);
    if (perTeam < MIN_TEAM_SIZE) continue;

    options.push({
      teamCount: t,
      playersPerTeam: perTeam,
      reserves: playerCount - perTeam * t,
    });
  }

  return options;
}
