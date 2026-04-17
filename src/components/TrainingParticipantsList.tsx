import type { Player } from '../types';
import ParticipantRow, { type MoveDestination } from './ParticipantRow';
import AddParticipantControl from './AddParticipantControl';

interface TrainingParticipantsListProps {
  title: string;
  participants: Player[];
  canEdit?: boolean;
  saving?: boolean;
  availablePlayers?: Player[];
  moveDestinationsFor?: (player: Player) => MoveDestination[];
  onAddPlayer?: (playerId: number) => void;
  onRemovePlayer?: (playerId: number) => void;
}

export default function TrainingParticipantsList({
  title,
  participants,
  canEdit = false,
  saving = false,
  availablePlayers = [],
  moveDestinationsFor,
  onAddPlayer,
  onRemovePlayer,
}: TrainingParticipantsListProps) {
  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="font-bold text-lg mb-3">
        {title}
        <span className="font-normal text-sm text-muted ml-2">
          ({participants.length})
        </span>
      </h3>
      <ul className="space-y-1">
        {[...participants].sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
          <ParticipantRow
            key={player.id}
            player={player}
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
    </div>
  );
}
