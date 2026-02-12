import type { Team, PlayerPreference, ScoreBreakdown } from '../types';
import {
  WEIGHT_RATING,
  WEIGHT_GENDER,
  WEIGHT_STRONG_PREF,
  WEIGHT_SOFT_PREF,
} from '../types';

export function teamAverageRating(team: Team): number {
  if (team.players.length === 0) return 0;
  const sum = team.players.reduce((acc, p) => acc + p.rating, 0);
  return sum / team.players.length;
}

/** Build a map from player ID to team index (undefined = reserves/not assigned). */
export function buildPlayerTeamMap(teams: Team[]): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 0; i < teams.length; i++) {
    for (const p of teams[i].players) {
      map.set(p.id, i);
    }
  }
  return map;
}

/** Build a map from player ID to player name for display purposes. */
function buildPlayerNameMap(teams: Team[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const team of teams) {
    for (const p of team.players) {
      map.set(p.id, p.name);
    }
  }
  return map;
}

export function scoreAssignment(
  teams: Team[],
  preferences: PlayerPreference[],
): ScoreBreakdown {
  const playerTeam = buildPlayerTeamMap(teams);
  const playerNames = buildPlayerNameMap(teams);

  // --- Rating penalty ---
  const allPlayers = teams.flatMap((t) => t.players);
  const overallAvg =
    allPlayers.length > 0
      ? allPlayers.reduce((sum, p) => sum + p.rating, 0) / allPlayers.length
      : 0;

  let ratingRaw = 0;
  for (const team of teams) {
    const avg = teamAverageRating(team);
    ratingRaw -= (avg - overallAvg) ** 2;
  }
  const ratingWeighted = WEIGHT_RATING * ratingRaw;

  // --- Gender penalty ---
  const totalMale = allPlayers.filter((p) => p.gender === 'male').length;
  const expectedMaleRatio = allPlayers.length > 0 ? totalMale / allPlayers.length : 0;

  let genderRaw = 0;
  for (const team of teams) {
    if (team.players.length === 0) continue;
    const maleCount = team.players.filter((p) => p.gender === 'male').length;
    const teamMaleRatio = maleCount / team.players.length;
    genderRaw -= Math.abs(teamMaleRatio - expectedMaleRatio);
  }
  const genderWeighted = WEIGHT_GENDER * genderRaw;

  // --- Strong preference penalty ---
  const strongViolations: ScoreBreakdown['strongPrefs']['violations'] = [];
  for (const pref of preferences) {
    if (pref.preference !== 'strongly_prefer_with') continue;
    const teamA = playerTeam.get(pref.player_a_id);
    const teamB = playerTeam.get(pref.player_b_id);
    // Only count if both players are on teams (not reserves)
    if (teamA !== undefined && teamB !== undefined && teamA !== teamB) {
      strongViolations.push({
        playerA: playerNames.get(pref.player_a_id) ?? `#${pref.player_a_id}`,
        playerB: playerNames.get(pref.player_b_id) ?? `#${pref.player_b_id}`,
      });
    }
  }
  const strongRaw = -strongViolations.length;
  const strongWeighted = WEIGHT_STRONG_PREF * strongRaw;

  // --- Soft preference penalty ---
  const softViolations: ScoreBreakdown['softPrefs']['violations'] = [];
  for (const pref of preferences) {
    const teamA = playerTeam.get(pref.player_a_id);
    const teamB = playerTeam.get(pref.player_b_id);
    if (teamA === undefined || teamB === undefined) continue;

    if (pref.preference === 'prefer_with' && teamA !== teamB) {
      softViolations.push({
        playerA: playerNames.get(pref.player_a_id) ?? `#${pref.player_a_id}`,
        playerB: playerNames.get(pref.player_b_id) ?? `#${pref.player_b_id}`,
        kind: 'split',
      });
    } else if (pref.preference === 'prefer_not_with' && teamA === teamB) {
      softViolations.push({
        playerA: playerNames.get(pref.player_a_id) ?? `#${pref.player_a_id}`,
        playerB: playerNames.get(pref.player_b_id) ?? `#${pref.player_b_id}`,
        kind: 'together',
      });
    }
  }
  const softRaw = -softViolations.length;
  const softWeighted = WEIGHT_SOFT_PREF * softRaw;

  return {
    rating: { raw: ratingRaw, weighted: ratingWeighted },
    gender: { raw: genderRaw, weighted: genderWeighted },
    strongPrefs: { violations: strongViolations, raw: strongRaw, weighted: strongWeighted },
    softPrefs: { violations: softViolations, raw: softRaw, weighted: softWeighted },
    total: ratingWeighted + genderWeighted + strongWeighted + softWeighted,
  };
}

/**
 * Fast score computation that only returns the total (no violation details).
 * Used by the hill-climbing optimizer for performance.
 */
export function scoreTotal(
  teams: Team[],
  preferences: PlayerPreference[],
  playerTeam: Map<number, number>,
): number {
  // Rating
  const allPlayers = teams.flatMap((t) => t.players);
  const overallAvg =
    allPlayers.length > 0
      ? allPlayers.reduce((sum, p) => sum + p.rating, 0) / allPlayers.length
      : 0;

  let ratingPenalty = 0;
  for (const team of teams) {
    const avg = teamAverageRating(team);
    ratingPenalty -= (avg - overallAvg) ** 2;
  }

  // Gender
  const totalMale = allPlayers.filter((p) => p.gender === 'male').length;
  const expectedMaleRatio = allPlayers.length > 0 ? totalMale / allPlayers.length : 0;

  let genderPenalty = 0;
  for (const team of teams) {
    if (team.players.length === 0) continue;
    const maleCount = team.players.filter((p) => p.gender === 'male').length;
    genderPenalty -= Math.abs(maleCount / team.players.length - expectedMaleRatio);
  }

  // Preferences
  let strongPenalty = 0;
  let softPenalty = 0;
  for (const pref of preferences) {
    const teamA = playerTeam.get(pref.player_a_id);
    const teamB = playerTeam.get(pref.player_b_id);
    if (teamA === undefined || teamB === undefined) continue;

    if (pref.preference === 'strongly_prefer_with' && teamA !== teamB) {
      strongPenalty--;
    } else if (pref.preference === 'prefer_with' && teamA !== teamB) {
      softPenalty--;
    } else if (pref.preference === 'prefer_not_with' && teamA === teamB) {
      softPenalty--;
    }
  }

  return (
    WEIGHT_RATING * ratingPenalty +
    WEIGHT_GENDER * genderPenalty +
    WEIGHT_STRONG_PREF * strongPenalty +
    WEIGHT_SOFT_PREF * softPenalty
  );
}
