import { useState } from 'react';
import type { Player } from '../types';
import { PlusIcon } from './icons';

interface AddParticipantControlProps {
  availablePlayers: Player[];
  onAdd: (playerId: number) => void;
  disabled?: boolean;
}

export default function AddParticipantControl({
  availablePlayers,
  onAdd,
  disabled = false,
}: AddParticipantControlProps) {
  const [expanded, setExpanded] = useState(false);

  if (availablePlayers.length === 0) return null;

  const sorted = [...availablePlayers].sort((a, b) => a.name.localeCompare(b.name));

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={disabled}
        className="mt-2 w-full py-1.5 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors flex items-center justify-center gap-1 disabled:cursor-not-allowed"
      >
        <PlusIcon className="w-4 h-4" /> Agregar jugador
      </button>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      <select
        autoFocus
        defaultValue=""
        disabled={disabled}
        onChange={(e) => {
          const value = e.target.value;
          if (value !== '') {
            onAdd(Number(value));
            setExpanded(false);
          }
        }}
        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-border bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Elegí jugador...</option>
        {sorted.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-muted-strong transition-colors"
      >
        Cancelar
      </button>
    </div>
  );
}
