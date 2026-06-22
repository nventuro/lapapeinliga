import { MIN_PLAYERS, MIN_TOURNAMENT_PLAYERS, MIN_TOURNAMENT_TEAMS } from '../types';
import { getValidTeamCounts } from '../utils/teamCalculator';
import { BarbellIcon, SwordsIcon, SoccerBallIcon, TrophyIcon } from './icons';

interface EventConfiguratorProps {
  selectedCount: number;
  onGenerate: (teamCount: number) => void;
  onTournament: (teamCount: number) => void;
  onTraining: () => void;
  onExternalMatch: () => void;
}

export default function EventConfigurator({
  selectedCount,
  onGenerate,
  onTournament,
  onTraining,
  onExternalMatch,
}: EventConfiguratorProps) {
  const canBuildTeams = selectedCount >= MIN_PLAYERS;
  const allOptions = canBuildTeams ? getValidTeamCounts(selectedCount) : [];
  const matchOptions = allOptions.filter((opt) => opt.teamCount === 2);

  const canBuildTournament = selectedCount >= MIN_TOURNAMENT_PLAYERS;
  const tournamentOptions = canBuildTournament
    ? allOptions.filter((opt) => opt.teamCount >= MIN_TOURNAMENT_TEAMS)
    : [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Armar evento</h2>
      <p className="text-sm text-muted mb-4">
        {selectedCount} jugadores seleccionados. Elegí el tipo de evento:
      </p>

      <div className="flex flex-col gap-3">
        {matchOptions.map((opt) => (
          <button
            key={`match-${opt.teamCount}`}
            onClick={() => onGenerate(opt.teamCount)}
            className="w-full py-3 px-4 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors text-left flex items-center gap-2"
          >
            <SoccerBallIcon className="w-5 h-5" />
            <span className="font-normal">
              {opt.playersPerTeam} por equipo
              {opt.reserves > 0
                ? `, ${opt.reserves} suplente${opt.reserves !== 1 ? 's' : ''}`
                : ''}
            </span>
          </button>
        ))}

        {tournamentOptions.map((opt) => (
          <button
            key={`tournament-${opt.teamCount}`}
            onClick={() => onTournament(opt.teamCount)}
            className="w-full py-3 px-4 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors text-left flex items-center gap-2"
          >
            <TrophyIcon className="w-5 h-5" />
            <span className="font-normal">
              {opt.teamCount} equipos, {opt.playersPerTeam} por equipo
              {opt.reserves > 0
                ? `, ${opt.reserves} suplente${opt.reserves !== 1 ? 's' : ''}`
                : ''}
            </span>
          </button>
        ))}

        <button
          onClick={onExternalMatch}
          className="w-full py-3 px-4 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors text-left flex items-center gap-2"
        >
          <SwordsIcon className="w-5 h-5" />
          <span className="font-normal">
            Partido externo, {selectedCount} en nuestro equipo
          </span>
        </button>

        <button
          onClick={onTraining}
          className="w-full py-3 px-4 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors text-left flex items-center gap-2"
        >
          <BarbellIcon className="w-5 h-5" />
          <span className="font-normal">
            {selectedCount} participantes
          </span>
        </button>
      </div>
    </div>
  );
}
