import type { Player, Team, PlayerPreference, PlayerLocks, ScoreBreakdown } from '../types';
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
 * Pre-places locked players, then distributes free players via gender
 * round-robin (when enforceGender) or simple shuffle.
 */
function generateInitialAssignment(
  players: Player[],
  teamCount: number,
  enforceGender: boolean,
  locks: PlayerLocks = new Map(),
): { teams: Team[]; reserves: Player[] } {
  const perTeam = playersPerTeam(players.length, teamCount);

  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({
    name: `Equipo ${String.fromCharCode(65 + i)}`,
    players: [],
  }));
  const reserves: Player[] = [];

  // Pre-place locked players
  const lockedIds = new Set(locks.keys());
  for (const player of players) {
    if (!lockedIds.has(player.id)) continue;
    const dest = locks.get(player.id)!;
    if (dest === 'reserves') {
      reserves.push(player);
    } else {
      teams[dest].players.push(player);
    }
  }

  const freePlayers = players.filter((p) => !lockedIds.has(p.id));

  if (enforceGender) {
    const females = shuffle(freePlayers.filter((p) => p.gender === 'female'));
    const males = shuffle(freePlayers.filter((p) => p.gender === 'male'));

    // Round-robin ALL free players of each gender across teams
    for (const pool of [females, males]) {
      let teamIdx = 0;
      for (const player of pool) {
        // Find next team that isn't full (wrap around)
        let attempts = 0;
        while (teams[teamIdx].players.length >= perTeam && attempts < teamCount) {
          teamIdx = (teamIdx + 1) % teamCount;
          attempts++;
        }
        if (attempts < teamCount) {
          teams[teamIdx].players.push(player);
          teamIdx = (teamIdx + 1) % teamCount;
        }
        // If all teams full, player stays unassigned (becomes reserve below)
      }
    }

    // Collect anyone not assigned as reserves
    const assigned = new Set(teams.flatMap((t) => t.players.map((p) => p.id)));
    for (const p of freePlayers) {
      if (!assigned.has(p.id)) reserves.push(p);
    }
    return { teams, reserves };
  }

  // No gender constraint: shuffle free players and deal
  const shuffled = shuffle(freePlayers);
  let idx = 0;
  for (let t = 0; t < teamCount && idx < shuffled.length; t++) {
    while (teams[t].players.length < perTeam && idx < shuffled.length) {
      teams[t].players.push(shuffled[idx++]);
    }
  }
  // Remaining free players become reserves
  while (idx < shuffled.length) {
    reserves.push(shuffled[idx++]);
  }
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
 * Locked players are never moved.
 */
function hillClimb(
  initialTeams: Team[],
  initialReserves: Player[],
  preferences: PlayerPreference[],
  enforceGender: boolean,
  locks: PlayerLocks = new Map(),
): { teams: Team[]; reserves: Player[]; totalScore: number } {
  const lockedIds = new Set(locks.keys());
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
            const playerA = teams[tA].players[pA];
            const playerB = teams[tB].players[pB];
            if (lockedIds.has(playerA.id) || lockedIds.has(playerB.id)) continue;

            // Apply swap
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
          if (lockedIds.has(teamPlayer.id) || lockedIds.has(reservePlayer.id)) continue;

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
  locks: PlayerLocks = new Map(),
): SortResult {
  const enforceGender = canEnforceGender(players, teamCount);

  let bestTeams: Team[] | null = null;
  let bestReserves: Player[] | null = null;
  let bestTotalScore = -Infinity;

  for (let start = 0; start < HILL_CLIMB_STARTS; start++) {
    const initial = generateInitialAssignment(players, teamCount, enforceGender, locks);
    const result = hillClimb(initial.teams, initial.reserves, preferences, enforceGender, locks);

    if (result.totalScore > bestTotalScore) {
      bestTotalScore = result.totalScore;
      bestTeams = result.teams;
      bestReserves = result.reserves;
    }
  }

  const score = scoreAssignment(bestTeams!, preferences);
  return { teams: bestTeams!, reserves: bestReserves!, score };
}
