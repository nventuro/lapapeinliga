import { MIN_PLAYERS } from '../types';
import { getValidTeamCounts } from '../utils/teamCalculator';

interface TeamConfiguratorProps {
  selectedCount: number;
  onGenerate: (teamCount: number) => void;
}

export default function TeamConfigurator({
  selectedCount,
  onGenerate,
}: TeamConfiguratorProps) {
  if (selectedCount < MIN_PLAYERS) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">Armar equipos</h2>
        <p className="text-muted">
          Se necesitan al menos {MIN_PLAYERS} jugadores para armar equipos. Tenés {selectedCount} seleccionados.
        </p>
      </div>
    );
  }

  const options = getValidTeamCounts(selectedCount);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Armar equipos</h2>
      <p className="text-sm text-muted mb-4">
        {selectedCount} jugadores seleccionados. Elegí cómo armar los equipos:
      </p>

      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.teamCount}
            onClick={() => onGenerate(opt.teamCount)}
            className="w-full py-3 px-4 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors text-left"
          >
            {opt.teamCount} equipos
            <span className="font-normal ml-2">
              — {opt.playersPerTeam} por equipo
              {opt.reserves > 0
                ? `, ${opt.reserves} suplente${opt.reserves !== 1 ? 's' : ''}`
                : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
