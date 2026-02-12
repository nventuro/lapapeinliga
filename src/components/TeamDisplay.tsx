import { useState } from 'react';
import type { Player, Team } from '../types';
import { MIN_TEAM_SIZE, MAX_TEAM_SIZE, MIN_GENDER_PER_TEAM } from '../types';
import { teamAverageRating } from '../utils/teamSorter';

interface TeamDisplayProps {
  teams: Team[];
  reserves: Player[];
  onTeamsChange: (teams: Team[], reserves: Player[]) => void;
  onResort: () => void;
  onReset: () => void;
}

export default function TeamDisplay({
  teams,
  reserves,
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
  const maxTeamSize = Math.max(...teams.map((t) => t.players.length));

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Equipos armados</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {teams.map((team, teamIndex) => {
          const size = team.players.length;
          const maleCount = team.players.filter((p) => p.gender === 'male').length;
          const femaleCount = team.players.filter((p) => p.gender === 'female').length;

          const errors: string[] = [];
          const warnings: string[] = [];
          if (size < MIN_TEAM_SIZE) errors.push(`Menos de ${MIN_TEAM_SIZE} jugadores`);
          if (size > MAX_TEAM_SIZE) errors.push(`Más de ${MAX_TEAM_SIZE} jugadores`);
          if (size < maxTeamSize) warnings.push('Equipo con menos jugadores');
          if (maleCount <= MIN_GENDER_PER_TEAM) warnings.push(`Solo ${maleCount} hombre${maleCount !== 1 ? 's' : ''} en el equipo`);
          if (femaleCount <= MIN_GENDER_PER_TEAM) warnings.push(`Solo ${femaleCount} mujer${femaleCount !== 1 ? 'es' : ''} en el equipo`);

          const hasError = errors.length > 0;
          const hasWarning = warnings.length > 0;
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
                <span className="text-sm text-muted">
                  Promedio: {teamAverageRating(team).toFixed(1)}
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
                    <span className="text-muted text-lg">
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
                {size} jugador{size !== 1 ? 'es' : ''} · {maleCount}<span className="text-base">♂</span> {femaleCount}<span className="text-base">♀</span>
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
                <span className="text-muted text-sm">
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

      <div className="flex gap-3">
        <button
          onClick={onResort}
          className="flex-1 py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors"
        >
          Volver a sortear
        </button>
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-lg font-bold text-muted-strong bg-neutral hover:bg-neutral-hover transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
