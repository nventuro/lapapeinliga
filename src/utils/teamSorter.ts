import type { Player, Team, PlayerPreference, ScoreBreakdown } from '../types';
import { MIN_GENDER_PER_TEAM, MAX_TEAM_SIZE, HILL_CLIMB_STARTS } from '../types';
import { scoreAssignment, scoreTotal, buildPlayerTeamMap } from './scoring';
import { playersPerTeam } from './teamCalculator';

// Re-export for existing consumers
export { teamAverageRating } from './scoring';

export interface SortResult {
  teams: Team[];
  reserves: Player[];
  score: ScoreBreakdown;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate one valid initial assignment.
 * If gender constraint is feasible (enough males & females for 1 per team),
 * distribute genders via round-robin first, then fill randomly.
 */
function generateInitialAssignment(
  players: Player[],
  teamCount: number,
  enforceGender: boolean,
): { teams: Team[]; reserves: Player[] } {
  const perTeam = playersPerTeam(players.length, teamCount);

  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    name: `Equipo ${String.fromCharCode(65 + i)}`,
    players: [],
  }));

  if (enforceGender) {
    const males = shuffle(players.filter((p) => p.gender === 'male'));
    const females = shuffle(players.filter((p) => p.gender === 'female'));

    // Round-robin MIN_GENDER_PER_TEAM of each gender to each team
    for (let g = 0; g < MIN_GENDER_PER_TEAM; g++) {
      for (let t = 0; t < teamCount; t++) {
        if (males.length > 0) teams[t].players.push(males.pop()!);
        if (females.length > 0) teams[t].players.push(females.pop()!);
      }
    }

    // Remaining players to fill
    const remaining = shuffle([...males, ...females]);
    let teamIdx = 0;
    for (const player of remaining) {
      // Fill teams that haven't reached perTeam yet
      while (teamIdx < teamCount && teams[teamIdx].players.length >= perTeam) {
        teamIdx++;
      }
      if (teamIdx < teamCount) {
        teams[teamIdx].players.push(player);
      }
      // If all teams full, remaining become reserves (handled below)
    }

    // Collect anyone not assigned
    const assigned = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
    const reserves = players.filter((p) => !assigned.has(p.id));
    return { teams, reserves };
  }

  // No gender constraint: simple shuffle and deal
  const shuffled = shuffle(players);
  for (let i = 0; i < teamCount; i++) {
    teams[i].players = shuffled.slice(i * perTeam, (i + 1) * perTeam);
  }
  const reserves = shuffled.slice(teamCount * perTeam);
  return { teams, reserves };
}

/** Check whether the gender hard constraint is feasible. */
function canEnforceGender(players: Player[], teamCount: number): boolean {
  const maleCount = players.filter((p) => p.gender === 'male').length;
  const femaleCount = players.filter((p) => p.gender === 'female').length;
  return maleCount >= teamCount * MIN_GENDER_PER_TEAM &&
    femaleCount >= teamCount * MIN_GENDER_PER_TEAM;
}

/** Validate hard constraints for a candidate assignment. */
function isValid(teams: Team[], enforceGender: boolean): boolean {
  const sizes = teams.map((t) => t.players.length);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  if (max - min > 1) return false;
  if (max > MAX_TEAM_SIZE) return false;

  if (enforceGender) {
    for (const team of teams) {
      if (team.players.length === 0) continue;
      const males = team.players.filter((p) => p.gender === 'male').length;
      const females = team.players.filter((p) => p.gender === 'female').length;
      if (males < MIN_GENDER_PER_TEAM || females < MIN_GENDER_PER_TEAM) return false;
    }
  }

  return true;
}

/** Deep clone teams and reserves for mutation during hill climbing. */
function cloneAssignment(teams: Team[], reserves: Player[]): { teams: Team[]; reserves: Player[] } {
  return {
    teams: teams.map((t) => ({ ...t, players: [...t.players] })),
    reserves: [...reserves],
  };
}

/**
 * Run one hill-climbing pass: try all swaps/moves, pick the best improvement, repeat.
 */
function hillClimb(
  initialTeams: Team[],
  initialReserves: Player[],
  preferences: PlayerPreference[],
  enforceGender: boolean,
): { teams: Team[]; reserves: Player[]; totalScore: number } {
  const { teams, reserves } = cloneAssignment(initialTeams, initialReserves);
  const playerTeam = buildPlayerTeamMap(teams);
  let currentScore = scoreTotal(teams, preferences, playerTeam);

  let improved = true;
  while (improved) {
    improved = false;
    let bestScore = currentScore;
    let bestOp: (() => void) | null = null;

    // --- Candidate: swap two players on different teams ---
    for (let tA = 0; tA < teams.length; tA++) {
      for (let tB = tA + 1; tB < teams.length; tB++) {
        for (let pA = 0; pA < teams[tA].players.length; pA++) {
          for (let pB = 0; pB < teams[tB].players.length; pB++) {
            // Apply swap
            const playerA = teams[tA].players[pA];
            const playerB = teams[tB].players[pB];
            teams[tA].players[pA] = playerB;
            teams[tB].players[pB] = playerA;
            playerTeam.set(playerA.id, tB);
            playerTeam.set(playerB.id, tA);

            if (isValid(teams, enforceGender)) {
              const s = scoreTotal(teams, preferences, playerTeam);
              if (s > bestScore) {
                bestScore = s;
                bestOp = (() => {
                  const a = tA, b = tB, ia = pA, ib = pB;
                  return () => {
                    const pA2 = teams[a].players[ia];
                    const pB2 = teams[b].players[ib];
                    teams[a].players[ia] = pB2;
                    teams[b].players[ib] = pA2;
                    playerTeam.set(pA2.id, b);
                    playerTeam.set(pB2.id, a);
                  };
                })();
              }
            }

            // Undo swap
            teams[tA].players[pA] = playerA;
            teams[tB].players[pB] = playerB;
            playerTeam.set(playerA.id, tA);
            playerTeam.set(playerB.id, tB);
          }
        }
      }
    }

    // --- Candidate: swap team player with reserve ---
    for (let t = 0; t < teams.length; t++) {
      for (let pIdx = 0; pIdx < teams[t].players.length; pIdx++) {
        for (let rIdx = 0; rIdx < reserves.length; rIdx++) {
          const teamPlayer = teams[t].players[pIdx];
          const reservePlayer = reserves[rIdx];

          // Apply swap
          teams[t].players[pIdx] = reservePlayer;
          reserves[rIdx] = teamPlayer;
          playerTeam.set(reservePlayer.id, t);
          playerTeam.delete(teamPlayer.id);

          if (isValid(teams, enforceGender)) {
            const s = scoreTotal(teams, preferences, playerTeam);
            if (s > bestScore) {
              bestScore = s;
              bestOp = (() => {
                const ct = t, cpIdx = pIdx, crIdx = rIdx;
                return () => {
                  const tp = teams[ct].players[cpIdx];
                  const rp = reserves[crIdx];
                  teams[ct].players[cpIdx] = rp;
                  reserves[crIdx] = tp;
                  playerTeam.set(rp.id, ct);
                  playerTeam.delete(tp.id);
                };
              })();
            }
          }

          // Undo swap
          teams[t].players[pIdx] = teamPlayer;
          reserves[rIdx] = reservePlayer;
          playerTeam.set(teamPlayer.id, t);
          playerTeam.delete(reservePlayer.id);
        }
      }
    }

    // Apply the best operation found
    if (bestOp && bestScore > currentScore) {
      bestOp();
      currentScore = bestScore;
      improved = true;
    }
  }

  return { teams, reserves, totalScore: currentScore };
}

export function sortTeams(
  players: Player[],
  teamCount: number,
  preferences: PlayerPreference[] = [],
): SortResult {
  const enforceGender = canEnforceGender(players, teamCount);

  let bestTeams: Team[] | null = null;
  let bestReserves: Player[] | null = null;
  let bestTotalScore = -Infinity;

  for (let start = 0; start < HILL_CLIMB_STARTS; start++) {
    const initial = generateInitialAssignment(players, teamCount, enforceGender);
    const result = hillClimb(initial.teams, initial.reserves, preferences, enforceGender);

    if (result.totalScore > bestTotalScore) {
      bestTotalScore = result.totalScore;
      bestTeams = result.teams;
      bestReserves = result.reserves;
    }
  }

  const score = scoreAssignment(bestTeams!, preferences);
  return { teams: bestTeams!, reserves: bestReserves!, score };
}
