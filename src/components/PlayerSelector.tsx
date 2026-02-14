import type { Player } from '../types';
import { effectiveRating } from '../types';
import RatingBadge from './RatingBadge';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';

interface PlayerSelectorProps {
  players: Player[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onSelectMany: (ids: number[]) => void;
  onDeselectMany: (ids: number[]) => void;
}

function GroupControls({ label, ids, selectedIds, onSelectMany, onDeselectMany }: {
  label: string;
  ids: number[];
  selectedIds: Set<number>;
  onSelectMany: (ids: number[]) => void;
  onDeselectMany: (ids: number[]) => void;
}) {
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
  const noneSelected = ids.every((id) => !selectedIds.has(id));

  return (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-semibold text-muted">{label}</h3>
      <div className="flex gap-2">
        <button
          onClick={() => onSelectMany(ids)}
          disabled={allSelected}
          className="text-xs px-2 py-0.5 rounded bg-neutral hover:bg-neutral-hover text-muted-strong disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Todos
        </button>
        <button
          onClick={() => onDeselectMany(ids)}
          disabled={noneSelected}
          className="text-xs px-2 py-0.5 rounded bg-neutral hover:bg-neutral-hover text-muted-strong disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Ninguno
        </button>
      </div>
    </div>
  );
}

export default function PlayerSelector({
  players,
  selectedIds,
  onToggle,
  onSelectMany,
  onDeselectMany,
}: PlayerSelectorProps) {
  const corePlayers = players
    .filter((p) => p.is_core !== false)
    .sort((a, b) => effectiveRating(b) - effectiveRating(a));
  const nonCorePlayers = players
    .filter((p) => p.is_core === false)
    .sort((a, b) => effectiveRating(b) - effectiveRating(a));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold">¿Quiénes juegan?</h2>
      </div>

      {/* Core players */}
      <GroupControls
        label="Fijos"
        ids={corePlayers.map((p) => p.id)}
        selectedIds={selectedIds}
        onSelectMany={onSelectMany}
        onDeselectMany={onDeselectMany}
      />
      <ul className="space-y-2">
        {corePlayers.map((player) => (
          <li key={player.id}>
            <label className="flex items-center gap-3 p-2 rounded hover:bg-border-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.has(player.id)}
                onChange={() => onToggle(player.id)}
                className="w-5 h-5 accent-primary"
              />
              <GenderIcon gender={player.gender} />
              <span className="font-medium">{player.name}</span>
              <RatingBadge rating={player.rating} className="ml-auto" />
            </label>
          </li>
        ))}
      </ul>

      {/* Non-core players */}
      {nonCorePlayers.length > 0 && (
        <>
          <div className="my-4 border-t border-border-subtle" />
          <GroupControls
            label="Invitados"
            ids={nonCorePlayers.map((p) => p.id)}
            selectedIds={selectedIds}
            onSelectMany={onSelectMany}
            onDeselectMany={onDeselectMany}
          />
          <ul className="space-y-2">
            {nonCorePlayers.map((player) => (
              <li key={player.id}>
                <label className="flex items-center gap-3 p-2 rounded hover:bg-border-subtle cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(player.id)}
                    onChange={() => onToggle(player.id)}
                    className="w-5 h-5 accent-primary"
                  />
                  <GenderIcon gender={player.gender} />
                  <span className="font-medium">{player.name}</span>
                  <InvBadge />
                  <RatingBadge rating={player.rating} className="ml-auto" />
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
