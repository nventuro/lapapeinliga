import { useState } from 'react';
import type { Player } from '../types';
import { isGuest } from '../types';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import SaveEventDialog from './SaveEventDialog';
import { useAppContext } from '../context/appContext';

interface ExternalMatchPreviewProps {
  players: Player[];
  onReset: () => void;
}

export default function ExternalMatchPreview({ players, onReset }: ExternalMatchPreviewProps) {
  const { isAdmin } = useAppContext();
  const [reserveIds, setReserveIds] = useState<Set<number>>(new Set());
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  function toggleReserve(id: number) {
    setReserveIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const starters = players.filter((p) => !reserveIds.has(p.id));
  const reserves = players.filter((p) => reserveIds.has(p.id));
  const sorted = [...players].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Partido externo</h2>
      <p className="text-sm text-muted mb-4">
        Marcá quiénes van al banco. El resto son titulares de nuestro equipo.
      </p>

      <ul className="space-y-1 mb-4">
        {sorted.map((player) => {
          const isReserve = reserveIds.has(player.id);
          return (
            <li
              key={player.id}
              onClick={() => toggleReserve(player.id)}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                isReserve ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-neutral'
              }`}
            >
              <GenderIcon gender={player.gender} />
              <span className="flex-1">{player.name}</span>
              {isGuest(player) && <InvBadge />}
              <span className="text-xs text-muted">
                {isReserve ? 'Suplente' : 'Titular'}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="text-sm text-muted mb-4">
        {starters.length} titular{starters.length !== 1 ? 'es' : ''} · {reserves.length} suplente{reserves.length !== 1 ? 's' : ''}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 rounded-lg font-bold text-muted-strong bg-neutral hover:bg-neutral-hover transition-colors"
        >
          Volver al inicio
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={starters.length === 0}
            className="flex-1 py-3 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
          >
            Guardar fecha
          </button>
        )}
      </div>

      {showSaveDialog && (
        <SaveEventDialog
          type="external_match"
          roster={starters}
          reserves={reserves}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
