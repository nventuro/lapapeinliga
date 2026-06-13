import type { TournamentTeam, Player, AwardType } from '../types';
import { comparePlayersByGenderThenName } from '../types';
import { GenderMaleIcon, GenderFemaleIcon } from './icons';
import Confetti from './Confetti';
import EditableTeamName from './EditableTeamName';
import ParticipantRow, { type MoveDestination } from './ParticipantRow';
import AddParticipantControl from './AddParticipantControl';

interface TournamentTeamCardProps {
  team: TournamentTeam;
  isWinner: boolean;
  playerAwards: Map<number, AwardType[]>;
  canEdit?: boolean;
  saving?: boolean;
  availablePlayers?: Player[];
  moveDestinationsFor?: (player: Player) => MoveDestination[];
  onAddPlayer?: (playerId: number) => void;
  onRemovePlayer?: (playerId: number) => void;
  canEditTeam?: boolean;
  onSaveTeam?: (name: string) => void;
}

export default function TournamentTeamCard({
  team,
  isWinner,
  playerAwards,
  canEdit = false,
  saving = false,
  availablePlayers = [],
  moveDestinationsFor,
  onAddPlayer,
  onRemovePlayer,
  canEditTeam = false,
  onSaveTeam,
}: TournamentTeamCardProps) {
  const maleCount = team.players.filter((p) => p.gender === 'male').length;
  const femaleCount = team.players.filter((p) => p.gender === 'female').length;

  return (
    <div
      className={`relative rounded-lg p-4 ${
        isWinner ? 'border-2 border-gold bg-gold-subtle' : 'border border-border'
      }`}
    >
      {isWinner && <Confetti />}
      <EditableTeamName
        name={team.name}
        isWinner={isWinner}
        canEdit={canEditTeam}
        saving={saving}
        onSave={onSaveTeam}
      />
      <ul className="space-y-1">
        {[...team.players].sort(comparePlayersByGenderThenName).map((player) => (
          <ParticipantRow
            key={player.id}
            player={player}
            awards={playerAwards.get(player.id)}
            canEdit={canEdit}
            disabled={saving}
            moveDestinations={moveDestinationsFor?.(player) ?? []}
            onRemove={onRemovePlayer ? () => onRemovePlayer(player.id) : undefined}
          />
        ))}
      </ul>
      {canEdit && onAddPlayer && (
        <AddParticipantControl
          availablePlayers={availablePlayers}
          onAdd={onAddPlayer}
          disabled={saving}
        />
      )}
      <div className="mt-2 pt-2 border-t border-border-subtle text-sm text-muted">
        <span>{team.players.length} jugador{team.players.length !== 1 ? 'es' : ''}</span>
        {' · '}
        <span>
          {maleCount}<GenderMaleIcon className="w-4 h-4 inline" />
        </span>
        {' '}
        <span>
          {femaleCount}<GenderFemaleIcon className="w-4 h-4 inline" />
        </span>
      </div>
    </div>
  );
}
