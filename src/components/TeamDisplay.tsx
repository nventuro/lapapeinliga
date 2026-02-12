import type { Team } from '../types';
import { teamAverageRating } from '../utils/teamSorter';

interface TeamDisplayProps {
  teams: Team[];
  onResort: () => void;
  onReset: () => void;
}

export default function TeamDisplay({ teams, onResort, onReset }: TeamDisplayProps) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Equipos armados</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {teams.map((team) => (
          <div
            key={team.name}
            className="border border-border rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">{team.name}</h3>
              <span className="text-sm text-muted">
                Promedio: {teamAverageRating(team).toFixed(1)}
              </span>
            </div>

            <ul className="space-y-1">
              {team.players.map((player) => (
                <li key={player.id} className="flex items-center gap-2 py-1">
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

            <div className="mt-3 pt-2 border-t border-border-subtle text-sm text-muted">
              {team.players.length} jugador{team.players.length !== 1 ? 'es' : ''}
            </div>
          </div>
        ))}
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
