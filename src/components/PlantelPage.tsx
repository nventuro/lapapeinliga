import { useState } from 'react';
import type { Player } from '../types';
import { PLAYER_TIERS, TIER_GROUP_LABELS } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { useEventStats, getLeaderIds } from '../hooks/useEventStats';
import { EditIcon, TrashIcon, TrophyIcon, SneakerIcon, BarbellIcon, ConeIcon } from './icons';
import PlayerModal from './PlayerModal';
import RatingBadge from './RatingBadge';
import GenderIcon from './GenderIcon';
import Tooltip from './Tooltip';

export default function PlantelPage() {
  const { players, isAdmin, showRatings, refetchData } = useAppContext();
  const { gamesPlayed, gamesWon, trainingsAttended, trainingsCoached, loading: statsLoading } = useEventStats();
  const [modalPlayer, setModalPlayer] = useState<Player | null | undefined>(undefined);
  // undefined = closed, null = creating, Player = editing

  const mostWonIds = statsLoading ? new Set<number>() : getLeaderIds(gamesWon);
  const mostPlayedIds = statsLoading ? new Set<number>() : getLeaderIds(gamesPlayed);
  const mostTrainedIds = statsLoading ? new Set<number>() : getLeaderIds(trainingsAttended);
  const mostCoachedIds = statsLoading ? new Set<number>() : getLeaderIds(trainingsCoached);

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
      {isAdmin && (
        <div className="flex items-center justify-center mb-6">
          <button
            onClick={() => setModalPlayer(null)}
            className="px-4 py-2 rounded-lg font-medium text-sm border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors"
          >
            Agregar jugador
          </button>
        </div>
      )}

      {PLAYER_TIERS.map((tier, index) => {
        const tierPlayers = players
          .filter((p) => p.tier === tier)
          .sort((a, b) => a.name.localeCompare(b.name));

        if (tierPlayers.length === 0) return null;

        return (
          <div key={tier}>
            {index > 0 && <div className="my-4 border-t border-border-subtle" />}
            <h3 className="text-sm font-semibold text-muted mb-2">{TIER_GROUP_LABELS[tier]}</h3>
            <ul className="space-y-1">
              {tierPlayers.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center gap-2 py-1 px-2 rounded hover:bg-border-subtle"
                >
                  <GenderIcon gender={player.gender} />
                  <span className="font-medium truncate">{player.name}</span>
                  {mostWonIds.has(player.id) && (
                    <Tooltip label={`Más partidos ganados (${gamesWon.get(player.id)})`}>
                      <TrophyIcon className="w-4 h-4 text-gold" />
                    </Tooltip>
                  )}
                  {mostPlayedIds.has(player.id) && (
                    <Tooltip label={`Más partidos jugados (${gamesPlayed.get(player.id)})`}>
                      <SneakerIcon className="w-4 h-4 text-gold" />
                    </Tooltip>
                  )}
                  {mostTrainedIds.has(player.id) && (
                    <Tooltip label={`Más entrenamientos asistidos (${trainingsAttended.get(player.id)})`}>
                      <BarbellIcon className="w-4 h-4 text-gold" />
                    </Tooltip>
                  )}
                  {mostCoachedIds.has(player.id) && (
                    <Tooltip label={`Más entrenamientos dirigidos (${trainingsCoached.get(player.id)})`}>
                      <ConeIcon className="w-4 h-4 text-gold" />
                    </Tooltip>
                  )}
                  {showRatings && <RatingBadge rating={player.rating} pill={false} className="text-sm text-muted" />}
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                      <Tooltip label="Editar jugador">
                        <button
                          onClick={() => setModalPlayer(player)}
                          className="text-muted hover:text-primary transition-colors p-1"
                        >
                          <EditIcon />
                        </button>
                      </Tooltip>
                      <Tooltip label="Eliminar jugador">
                        <button
                          onClick={() => handleDelete(player)}
                          className="text-muted hover:text-error transition-colors p-1"
                        >
                          <TrashIcon />
                        </button>
                      </Tooltip>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {players.length === 0 && (
        <p className="text-center text-muted py-8">
          No hay jugadores cargados.{isAdmin && ' Agregá el primero.'}
        </p>
      )}

      {isAdmin && modalPlayer !== undefined && (
        <PlayerModal
          player={modalPlayer}
          onClose={() => setModalPlayer(undefined)}
        />
      )}
    </div>
  );
}
