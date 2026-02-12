import type { Player } from '../types';

interface PlayerSelectorProps {
  players: Player[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function ratingStars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default function PlayerSelector({
  players,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: PlayerSelectorProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">¿Quiénes juegan?</h2>
        <span className="text-sm text-muted">
          {selectedIds.size} / {players.length} jugadores
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={onSelectAll}
          className="text-sm px-3 py-1 rounded bg-neutral hover:bg-neutral-hover text-muted-strong"
        >
          Seleccionar todos
        </button>
        <button
          onClick={onDeselectAll}
          className="text-sm px-3 py-1 rounded bg-neutral hover:bg-neutral-hover text-muted-strong"
        >
          Deseleccionar todos
        </button>
      </div>

      <ul className="space-y-2">
        {players.map((player) => (
          <li key={player.id}>
            <label className="flex items-center gap-3 p-2 rounded hover:bg-border-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.has(player.id)}
                onChange={() => onToggle(player.id)}
                className="w-5 h-5 accent-primary"
              />
              <span className="font-medium">{player.name}</span>
              <span className="text-rating text-sm ml-auto">
                {ratingStars(player.rating)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
