import { useState } from 'react';
import type { Player, PlayerPreference, Team } from '../types';
import { MIN_TEAM_SIZE, MAX_TEAM_SIZE, MIN_GENDER_PER_TEAM, MAX_RATING_SPREAD } from '../types';
import { teamAverageRating } from '../utils/teamSorter';
import { scoreAssignment } from '../utils/scoring';

type HighlightLevel = 'error' | 'warning' | null;

function highlightClasses(level: HighlightLevel): string {
  if (level === 'error') return 'text-error font-semibold';
  if (level === 'warning') return 'text-warning font-semibold';
  return '';
}

interface TeamDisplayProps {
  teams: Team[];
  reserves: Player[];
  preferences: PlayerPreference[];
  onTeamsChange: (teams: Team[], reserves: Player[]) => void;
  onResort: () => void;
  onReset: () => void;
}

export default function TeamDisplay({
  teams,
  reserves,
  preferences,
  onTeamsChange,
  onResort,
  onReset,
}: TeamDisplayProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  function handlePlayerTap(playerId: number) {
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  }

  // Find where the selected player currently is
  let selectedPlayer: Player | undefined;
  let selectedSourceTeamIndex: number | null = null;
  let selectedFromReserves = false;

  if (selectedPlayerId !== null) {
    for (let i = 0; i < teams.length; i++) {
      const found = teams[i].players.find((p) => p.id === selectedPlayerId);
      if (found) {
        selectedPlayer = found;
        selectedSourceTeamIndex = i;
        break;
      }
    }
    if (!selectedPlayer) {
      selectedPlayer = reserves.find((p) => p.id === selectedPlayerId);
      if (selectedPlayer) selectedFromReserves = true;
    }
  }

  const isPlayerSelected = selectedPlayer !== undefined;

  function movePlayerTo(destination: 'reserves' | number) {
    if (!selectedPlayer) return;

    // Build new state
    const newTeams = teams.map((t) => ({
      ...t,
      players: t.players.filter((p) => p.id !== selectedPlayerId),
    }));
    const newReserves = reserves.filter((p) => p.id !== selectedPlayerId);

    if (destination === 'reserves') {
      newReserves.push(selectedPlayer);
    } else {
      newTeams[destination].players.push(selectedPlayer);
    }

    setSelectedPlayerId(null);
    onTeamsChange(newTeams, newReserves);
  }

  // Score breakdown (recomputed on every render so it updates after manual moves)
  const score = scoreAssignment(teams, preferences);

  const teamSizes = teams.map((t) => t.players.length);
  const sizeImbalance = new Set(teamSizes).size > 1;
  const minSize = Math.min(...teamSizes);
  const maxSize = Math.max(...teamSizes);

  const averageRatings = teams.map((t) => teamAverageRating(t));
  const ratingSpread = Math.max(...averageRatings) - Math.min(...averageRatings);
  const hasRatingSpreadWarning = ratingSpread >= MAX_RATING_SPREAD;
  const minRating = Math.min(...averageRatings);
  const maxRating = Math.max(...averageRatings);

  const hasViolations = score.strongPrefs.violations.length > 0 || score.softPrefs.violations.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Equipos armados</h2>
        <button
          onClick={onResort}
          className="text-sm px-3 py-1 rounded-full border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
        >
          Volver a sortear
        </button>
      </div>

      {/* Score breakdown */}
      <div className="mb-4 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm">Puntaje del armado</h3>
          <span className="text-sm font-semibold text-muted-strong">
            {score.total.toFixed(1)}
          </span>
        </div>
        <div className="space-y-1 text-sm text-muted">
          <div className="flex justify-between">
            <span>Nivel</span>
            <span>{score.rating.weighted.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span>Género</span>
            <span>{score.gender.weighted.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span>Preferencias fuertes</span>
            <span>{score.strongPrefs.weighted.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span>Preferencias suaves</span>
            <span>{score.softPrefs.weighted.toFixed(1)}</span>
          </div>
        </div>

        {hasViolations && (
          <div className="mt-3 pt-3 border-t border-border-subtle space-y-1 text-sm">
            {score.strongPrefs.violations.map((v, i) => (
              <p key={`strong-${i}`} className="text-warning">
                {v.playerA} y {v.playerB} <span className="font-semibold">realmente</span> prefieren estar en el mismo equipo pero están separados
              </p>
            ))}
            {score.softPrefs.violations.map((v, i) => (
              <p key={`soft-${i}`} className="text-muted">
                {v.kind === 'split'
                  ? `${v.playerA} y ${v.playerB} prefieren estar en el mismo equipo pero están separados`
                  : `${v.playerA} y ${v.playerB} prefieren no estar en el mismo equipo pero están juntos`}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {teams.map((team, teamIndex) => {
          const size = team.players.length;
          const maleCount = team.players.filter((p) => p.gender === 'male').length;
          const femaleCount = team.players.filter((p) => p.gender === 'female').length;

          const errors: string[] = [];
          const warnings: string[] = [];
          if (size < MIN_TEAM_SIZE) errors.push(`Menos de ${MIN_TEAM_SIZE} jugadores`);
          if (size > MAX_TEAM_SIZE) errors.push(`Más de ${MAX_TEAM_SIZE} jugadores`);
          if (maleCount === 0) warnings.push('No hay hombres en el equipo');
          else if (maleCount <= MIN_GENDER_PER_TEAM) warnings.push(`Solo ${maleCount} hombre en el equipo`);
          if (femaleCount === 0) warnings.push('No hay mujeres en el equipo');
          else if (femaleCount <= MIN_GENDER_PER_TEAM) warnings.push(`Solo ${femaleCount} mujer en el equipo`);

          const hasError = errors.length > 0;
          const hasWarning = warnings.length > 0;

          // Highlight levels for specific values (error takes precedence over warning)
          const countHighlight: HighlightLevel =
            (size < MIN_TEAM_SIZE || size > MAX_TEAM_SIZE) ? 'error'
            : (sizeImbalance && (size === minSize || size === maxSize)) ? 'warning'
            : null;

          const avgRating = averageRatings[teamIndex];
          const ratingHighlight: HighlightLevel =
            (hasRatingSpreadWarning && (avgRating === minRating || avgRating === maxRating)) ? 'warning'
            : null;

          const maleHighlight: HighlightLevel =
            maleCount <= MIN_GENDER_PER_TEAM ? 'warning' : null;

          const femaleHighlight: HighlightLevel =
            femaleCount <= MIN_GENDER_PER_TEAM ? 'warning' : null;

          const showMoveButton = isPlayerSelected && selectedSourceTeamIndex !== teamIndex;

          return (
            <div
              key={team.name}
              className={`rounded-lg p-4 ${
                hasError
                  ? 'border-2 border-error'
                  : hasWarning
                    ? 'border-2 border-warning'
                    : 'border border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">{team.name}</h3>
                <span className={`text-sm ${ratingHighlight ? highlightClasses(ratingHighlight) : 'text-muted'}`}>
                  Promedio: {avgRating.toFixed(1)}
                </span>
              </div>

              <ul className="space-y-1">
                {team.players.map((player) => (
                  <li
                    key={player.id}
                    onClick={() => handlePlayerTap(player.id)}
                    className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors ${
                      selectedPlayerId === player.id
                        ? 'bg-primary/20 ring-2 ring-primary'
                        : 'hover:bg-neutral'
                    }`}
                  >
                    <span className="text-muted text-xl">
                      {player.gender === 'male' ? '♂' : '♀'}
                    </span>
                    <span>{player.name}</span>
                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral text-muted-strong">
                      {player.rating}/10
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 pt-2 border-t border-border-subtle text-sm text-muted">
                <span className={highlightClasses(countHighlight)}>
                  {size} jugador{size !== 1 ? 'es' : ''}
                </span>
                {' · '}
                <span className={highlightClasses(maleHighlight)}>
                  {maleCount}<span className={`text-lg ${maleHighlight ? '' : 'text-muted'}`}>♂</span>
                </span>
                {' '}
                <span className={highlightClasses(femaleHighlight)}>
                  {femaleCount}<span className={`text-lg ${femaleHighlight ? '' : 'text-muted'}`}>♀</span>
                </span>
              </div>

              {(hasError || hasWarning) && (
                <div className="mt-1 space-y-0.5">
                  {errors.map((e) => (
                    <p key={e} className="text-sm text-error">
                      {e}
                    </p>
                  ))}
                  {warnings.map((w) => (
                    <p key={w} className="text-sm text-warning">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {showMoveButton && (
                <button
                  onClick={() => movePlayerTo(teamIndex)}
                  className="mt-2 w-full py-2 rounded-lg text-sm font-medium bg-neutral hover:bg-neutral-hover transition-colors"
                >
                  Mover acá
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Reserves section */}
      <div className="border border-border rounded-lg p-4 mb-6">
        <h3 className="font-bold text-lg mb-3">
          Suplentes
          <span className="font-normal text-sm text-muted ml-2">
            ({reserves.length})
          </span>
        </h3>

        {reserves.length > 0 ? (
          <ul className="space-y-1">
            {reserves.map((player) => (
              <li
                key={player.id}
                onClick={() => handlePlayerTap(player.id)}
                className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors ${
                  selectedPlayerId === player.id
                    ? 'bg-primary/20 ring-2 ring-primary'
                    : 'hover:bg-neutral'
                }`}
              >
                <span className="text-muted text-xl">
                  {player.gender === 'male' ? '♂' : '♀'}
                </span>
                <span>{player.name}</span>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral text-muted-strong">
                  {player.rating}/10
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No hay suplentes.</p>
        )}

        {isPlayerSelected && !selectedFromReserves && (
          <button
            onClick={() => movePlayerTo('reserves')}
            className="mt-2 w-full py-2 rounded-lg text-sm font-medium bg-neutral hover:bg-neutral-hover transition-colors"
          >
            Mover acá
          </button>
        )}
      </div>

      <button
        onClick={onReset}
        className="w-full py-3 rounded-lg font-bold text-muted-strong bg-neutral hover:bg-neutral-hover transition-colors"
      >
        Volver al inicio
      </button>
    </div>
  );
}
