import { useState, useMemo } from 'react';
import type { Player, TaggedPlayer } from '../types';

interface PlayerTagInputProps {
  candidates: Player[];
  selected: TaggedPlayer[];
  onChange: (players: TaggedPlayer[]) => void;
  loading?: boolean;
}

export default function PlayerTagInput({ candidates, selected, onChange, loading }: PlayerTagInputProps) {
  const [search, setSearch] = useState('');

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  const filtered = useMemo(() => {
    if (!search.trim()) return candidates;
    const term = search.toLowerCase();
    return candidates.filter((p) => p.name.toLowerCase().includes(term));
  }, [candidates, search]);

  function togglePlayer(player: Player) {
    if (selectedIds.has(player.id)) {
      onChange(selected.filter((p) => p.id !== player.id));
    } else {
      onChange([...selected, { id: player.id, name: player.name }]);
    }
  }

  if (loading) {
    return <p className="text-xs text-muted">Cargando jugadores...</p>;
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted">Personas</label>

      {/* Search input */}
      {candidates.length > 6 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jugador..."
          className="w-full px-2 py-1 border border-border rounded text-xs bg-surface text-on-surface placeholder:text-muted"
        />
      )}

      {/* Player chips */}
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((player) => {
          const isActive = selectedIds.has(player.id);
          return (
            <button
              key={player.id}
              type="button"
              onClick={() => togglePlayer(player)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-on-surface text-surface'
                  : 'bg-border-subtle text-muted hover:text-muted-strong'
              }`}
            >
              {player.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
