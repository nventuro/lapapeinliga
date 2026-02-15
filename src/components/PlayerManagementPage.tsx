import { useState } from 'react';
import type { Player } from '../types';
import { TIER_ORDER, isGuest } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { EditIcon, TrashIcon } from './icons';
import PlayerModal from './PlayerModal';
import RatingBadge from './RatingBadge';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import NoAccess from './NoAccess';

export default function PlayerManagementPage() {
  const { players, isAdmin, refetchData } = useAppContext();
  const [modalPlayer, setModalPlayer] = useState<Player | null | undefined>(undefined);
  // undefined = closed, null = creating, Player = editing

  if (!isAdmin) {
    return <NoAccess />;
  }

  async function handleDelete(player: Player) {
    if (!window.confirm(`¿Eliminar a ${player.name}? Esta acción no se puede deshacer.`)) {
      return;
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', player.id);

    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }

    await refetchData();
  }

  return (
    <div>
      <div className="flex justify-center mb-6">
        <button
          onClick={() => setModalPlayer(null)}
          className="px-4 py-2 rounded-lg font-medium text-sm border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors"
        >
          Agregar jugador
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...players]
          .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.name.localeCompare(b.name))
          .map((player) => (
          <div
            key={player.id}
            className="border border-border rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <GenderIcon gender={player.gender} />
              <span className="font-medium truncate">{player.name}</span>
              {isGuest(player) && <InvBadge />}
              <RatingBadge rating={player.rating} pill={false} className="text-sm text-muted" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setModalPlayer(player)}
                className="text-muted hover:text-primary transition-colors p-1"
                title="Editar jugador"
              >
                <EditIcon />
              </button>
              <button
                onClick={() => handleDelete(player)}
                className="text-muted hover:text-error transition-colors p-1"
                title="Eliminar jugador"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      {players.length === 0 && (
        <p className="text-center text-muted py-8">
          No hay jugadores cargados. Agregá el primero.
        </p>
      )}

      {modalPlayer !== undefined && (
        <PlayerModal
          player={modalPlayer}
          onClose={() => setModalPlayer(undefined)}
        />
      )}
    </div>
  );
}
