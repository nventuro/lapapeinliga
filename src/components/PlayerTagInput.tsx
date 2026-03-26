import { useState, useMemo } from 'react';
import type { Player, TaggedPlayer } from '../types';

interface PlayerTagInputProps {
  candidates: Player[];
  allPlayers: Player[];
  selected: TaggedPlayer[];
  onChange: (players: TaggedPlayer[]) => void;
  loading?: boolean;
}

export default function PlayerTagInput({ candidates, allPlayers, selected, onChange, loading }: PlayerTagInputProps) {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);
  const candidateIds = useMemo(() => new Set(candidates.map((p) => p.id)), [candidates]);

  // Selected players that aren't candidates (added via search)
  const selectedNonCandidates = useMemo(
    () => selected.filter((p) => !candidateIds.has(p.id)),
    [selected, candidateIds],
  );

  // When searching, show matching non-candidate players
  const extraResults = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.toLowerCase();
    return allPlayers
      .filter((p) => !candidateIds.has(p.id) && p.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlayers, candidateIds, search]);

  function togglePlayer(player: TaggedPlayer) {
    if (selectedIds.has(player.id)) {
      onChange(selected.filter((p) => p.id !== player.id));
    } else {
      onChange([...selected, { id: player.id, name: player.name }]);
    }
  }

  if (loading) {
    return <p className="text-xs text-muted">Cargando jugadores...</p>;
  }

  if (candidates.length === 0 && allPlayers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted">Personas</label>

      {/* Candidate chips (event participants) + inline "+" button */}
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((player) => {
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
        {selectedNonCandidates.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => togglePlayer(player)}
            className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border border-dashed bg-on-surface text-surface border-transparent"
          >
            {player.name}
          </button>
        ))}
        {!showSearch && (
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-border-subtle text-muted hover:text-muted-strong transition-colors"
          >
            +
          </button>
        )}
      </div>

      {/* Search for non-participants */}
      {showSearch && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => { if (!search.trim()) { setShowSearch(false); } }}
            placeholder="Buscar jugador..."
            autoFocus
            className="w-full px-2 py-1 border border-border rounded text-xs bg-surface text-on-surface placeholder:text-muted"
          />
          {extraResults.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {extraResults.map((player) => {
                const isActive = selectedIds.has(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border border-dashed ${
                      isActive
                        ? 'bg-on-surface text-surface border-transparent'
                        : 'border-border text-muted hover:text-muted-strong'
                    }`}
                  >
                    {player.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
