import type { Player } from '../types';
import { compareByName } from '../types';
import ParticipantRow, { type MoveDestination } from './ParticipantRow';
import AddParticipantControl from './AddParticipantControl';

interface ParticipantListCardProps {
  title: string;
  players: Player[];
  canEdit?: boolean;
  saving?: boolean;
  availablePlayers?: Player[];
  moveDestinationsFor?: (player: Player) => MoveDestination[];
  onAddPlayer?: (playerId: number) => void;
  onRemovePlayer?: (playerId: number) => void;
  /** Hide the whole card when empty and not editable (e.g. reserves). */
  hideWhenEmpty?: boolean;
  className?: string;
}

/**
 * A flat, name-sorted participant list card (reserves, training attendees,
 * coaches). One rendering source of truth for every roster list without team
 * structure.
 */
export default function ParticipantListCard({
  title,
  players,
  canEdit = false,
  saving = false,
  availablePlayers = [],
  moveDestinationsFor,
  onAddPlayer,
  onRemovePlayer,
  hideWhenEmpty = false,
  className = '',
}: ParticipantListCardProps) {
  if (hideWhenEmpty && players.length === 0 && !canEdit) return null;

  return (
    <div className={`bg-surface border border-border rounded-lg p-4 ${className}`}>
      <h3 className="font-bold text-lg mb-3">
        {title}
        <span className="font-normal text-sm text-muted ml-2">
          ({players.length})
        </span>
      </h3>
      {players.length > 0 && (
        <ul className="space-y-1">
          {[...players].sort(compareByName).map((player) => (
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
