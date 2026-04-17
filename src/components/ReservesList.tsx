import type { Player } from '../types';
import ParticipantRow, { type MoveDestination } from './ParticipantRow';
import AddParticipantControl from './AddParticipantControl';

interface ReservesListProps {
  reserves: Player[];
  canEdit?: boolean;
  saving?: boolean;
  availablePlayers?: Player[];
  moveDestinationsFor?: (player: Player) => MoveDestination[];
  onAddPlayer?: (playerId: number) => void;
  onRemovePlayer?: (playerId: number) => void;
}

export default function ReservesList({
  reserves,
  canEdit = false,
  saving = false,
  availablePlayers = [],
  moveDestinationsFor,
  onAddPlayer,
  onRemovePlayer,
}: ReservesListProps) {
  // Hide the whole card when there are no reserves and editing is disabled
  if (reserves.length === 0 && !canEdit) return null;

  return (
    <div className="border border-border rounded-lg p-4 mt-4">
      <h3 className="font-bold text-lg mb-3">
        Suplentes
        <span className="font-normal text-sm text-muted ml-2">
          ({reserves.length})
        </span>
      </h3>
      {reserves.length > 0 && (
        <ul className="space-y-1">
          {[...reserves].sort((a, b) => a.name.localeCompare(b.name)).map((player) => (
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
      )}
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
