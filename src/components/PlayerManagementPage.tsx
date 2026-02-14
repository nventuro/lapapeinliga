import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Player } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import PlayerModal from './PlayerModal';
import RatingBadge from './RatingBadge';

export default function PlayerManagementPage() {
  const { players, isAdmin, refetchData } = useAppContext();
  const [modalPlayer, setModalPlayer] = useState<Player | null | undefined>(undefined);
  // undefined = closed, null = creating, Player = editing

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted mb-4">No tenés acceso a esta sección.</p>
        <Link to="/" className="text-primary hover:text-primary-hover underline">
          Volver al inicio
        </Link>
      </div>
    );
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Jugadores</h2>
        <button
          onClick={() => setModalPlayer(null)}
          className="px-4 py-2 rounded-lg font-medium text-sm text-on-primary bg-primary hover:bg-primary-hover transition-colors"
        >
          Agregar jugador
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {players.map((player) => (
          <div
            key={player.id}
            className="border border-border rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg" title={player.gender === 'male' ? 'Masculino' : 'Femenino'}>
                {player.gender === 'male' ? '♂' : '♀'}
              </span>
              <span className="font-medium truncate">{player.name}</span>
              <RatingBadge rating={player.rating} pill={false} className="text-sm text-muted" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setModalPlayer(player)}
                className="text-muted hover:text-primary transition-colors p-1"
                title="Editar jugador"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343z" />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(player)}
                className="text-muted hover:text-error transition-colors p-1"
                title="Eliminar jugador"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 0 1 .7.798l-.35 5.25a.75.75 0 0 1-1.497-.1l.35-5.25a.75.75 0 0 1 .797-.698zm2.84 0a.75.75 0 0 1 .798.698l.35 5.25a.75.75 0 0 1-1.498.1l-.35-5.25a.75.75 0 0 1 .7-.798z" clipRule="evenodd" />
                </svg>
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
