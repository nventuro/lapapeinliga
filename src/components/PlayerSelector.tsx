import type { Player } from '../types';
import { PLAYER_TIERS, TIER_GROUP_LABELS } from '../types';
import RatingBadge from './RatingBadge';
import GenderIcon from './GenderIcon';

interface PlayerSelectorProps {
  players: Player[];
  selectedIds: Set<number>;
  showRatings: boolean;
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
  showRatings,
  onToggle,
  onSelectMany,
  onDeselectMany,
}: PlayerSelectorProps) {
  const tierGroups = PLAYER_TIERS.map((tier) => ({
    tier,
    players: players
      .filter((p) => p.tier === tier)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold">¿Quiénes juegan?</h2>
      </div>

      {tierGroups.map(({ tier, players: tierPlayers }, index) =>
        tierPlayers.length > 0 && (
          <div key={tier}>
            {index > 0 && <div className="my-4 border-t border-border-subtle" />}
            <GroupControls
              label={TIER_GROUP_LABELS[tier]}
              ids={tierPlayers.map((p) => p.id)}
              selectedIds={selectedIds}
              onSelectMany={onSelectMany}
              onDeselectMany={onDeselectMany}
            />
            <ul className="space-y-1">
              {tierPlayers.map((player) => (
                <li key={player.id}>
                  <label className="flex items-center gap-2 py-1 px-2 rounded hover:bg-border-subtle cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(player.id)}
                      onChange={() => onToggle(player.id)}
                      className="w-5 h-5 accent-primary"
                    />
                    <GenderIcon gender={player.gender} />
                    <span className="font-medium">{player.name}</span>
                    {showRatings && <RatingBadge rating={player.rating} className="ml-auto" />}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
