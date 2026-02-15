import { useState } from 'react';
import type { Player } from '../types';
import { PLAYER_TIERS, TIER_GROUP_LABELS } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { EditIcon, TrashIcon } from './icons';
import PlayerModal from './PlayerModal';
import RatingBadge from './RatingBadge';
import GenderIcon from './GenderIcon';
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

      {PLAYER_TIERS.map((tier, index) => {
        const tierPlayers = players
          .filter((p) => p.tier === tier)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (tierPlayers.length === 0) return null;

        return (
          <div key={tier}>
            {index > 0 && <div className="my-4 border-t border-border-subtle" />}
            <h3 className="text-sm font-semibold text-muted mb-2">{TIER_GROUP_LABELS[tier]}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tierPlayers.map((player) => (
                <div
                  key={player.id}
                  className="border border-border rounded-xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GenderIcon gender={player.gender} />
                    <span className="font-medium truncate">{player.name}</span>
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
          </div>
        );
      })}

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
