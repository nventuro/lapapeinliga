import { MIN_PLAYERS } from '../types';
import { getValidTeamCounts } from '../utils/teamCalculator';
import { BarbellIcon } from './icons';

interface EventConfiguratorProps {
  selectedCount: number;
  onGenerate: (teamCount: number) => void;
  onTraining: () => void;
}

export default function EventConfigurator({
  selectedCount,
  onGenerate,
  onTraining,
}: EventConfiguratorProps) {
  const canBuildTeams = selectedCount >= MIN_PLAYERS;
  const options = canBuildTeams ? getValidTeamCounts(selectedCount) : [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Armar evento</h2>
      <p className="text-sm text-muted mb-4">
        {selectedCount} jugadores seleccionados. Elegí el tipo de evento:
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

        <button
          onClick={onTraining}
          className="w-full py-3 px-4 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors text-left flex items-center gap-2"
        >
          <BarbellIcon className="w-5 h-5" />
          Entrenamiento
          <span className="font-normal ml-1">
            — {selectedCount} jugadores
          </span>
        </button>
      </div>
    </div>
  );
}
