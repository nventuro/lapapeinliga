import { useState, useRef, useEffect } from 'react';
import type { Player } from '../types';

interface PlayerSearchFilterProps {
  players: Player[];
  selectedPlayerId: number | null;
  onChange: (playerId: number | null) => void;
}

export default function PlayerSearchFilter({ players, selectedPlayerId, onChange }: PlayerSearchFilterProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(player: Player) {
    onChange(player.id);
    setSearch('');
    setIsOpen(false);
  }

  // If a player is selected, show as a removable badge instead of the search input
  if (selectedPlayerId !== null) {
    const selected = players.find((p) => p.id === selectedPlayerId);
    if (!selected) return null;
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">Jugador:</span>
        <button
          onClick={() => onChange(null)}
          className="px-3 py-1 rounded-full text-sm font-medium bg-on-surface text-surface hover:opacity-80 transition-opacity"
        >
          {selected.name} ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
        onFocus={() => { if (search.trim()) setIsOpen(true); }}
        placeholder="Buscar jugador..."
        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-surface border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((player) => (
            <li key={player.id}>
              <button
                onClick={() => handleSelect(player)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-border-subtle transition-colors"
              >
                {player.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
