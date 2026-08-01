import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Player, AwardType } from '../types';
import { groupPlayersForRoster, AWARD_TYPES, AWARD_LABELS } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext, useCurrentPlayer } from '../context/appContext';
import { useEventStats, getLeaderIds } from '../hooks/useEventStats';
import { EditIcon, TrashIcon, TrophyIcon, SneakerIcon, BarbellIcon, SpeakerphoneIcon, PhotosIcon, MailOffIcon } from './icons';
import { AWARD_ICONS } from './awardIcons';
import PlayerModal from './PlayerModal';
import RatingBadge from './RatingBadge';
import GenderIcon from './GenderIcon';
import Tooltip from './Tooltip';

export default function PlantelPage() {
  const navigate = useNavigate();
  const { players, isAdmin, showRatings, refetchData } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const { gamesPlayed, gamesWon, awardCounts, trainingsAttended, trainingsCoached, loading: statsLoading } = useEventStats();
  const [modalPlayer, setModalPlayer] = useState<Player | null | undefined>(undefined);
  // undefined = closed, null = creating, Player = editing

  // Players who have at least one tagged photo
  const [playersWithPhotos, setPlayersWithPhotos] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function fetchTaggedPlayers() {
      const { data } = await supabase
        .from('media_player_tags')
        .select('player_id');
      if (data) {
        setPlayersWithPhotos(new Set(data.map((r: { player_id: number }) => r.player_id)));
      }
    }
    fetchTaggedPlayers();
  }, []);

  const mostWonIds = statsLoading ? new Set<number>() : getLeaderIds(gamesWon);
  const mostPlayedIds = statsLoading ? new Set<number>() : getLeaderIds(gamesPlayed);
  const mostTrainedIds = statsLoading ? new Set<number>() : getLeaderIds(trainingsAttended);
  const mostCoachedIds = statsLoading ? new Set<number>() : getLeaderIds(trainingsCoached);

  const awardLeaders = statsLoading
    ? new Map<AwardType, Set<number>>()
    : new Map(AWARD_TYPES.map((a) => [a, getLeaderIds(awardCounts.get(a) ?? new Map())]));

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
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setModalPlayer(null)}
            className="px-4 py-2 rounded-lg font-medium text-sm border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors"
          >
            Agregar jugador
          </button>
          <button
            onClick={() => navigate('/armado')}
            className="px-4 py-2 rounded-lg font-medium text-sm border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors"
          >
            Armado
          </button>
        </div>
      )}

      {groupPlayersForRoster(players, isAdmin).map(({ key, label, players: tierPlayers }, index) => {
        return (
          <div key={key}>
            {index > 0 && <div className="my-4 border-t border-border-subtle" />}
            {label && <h3 className="text-sm font-semibold text-muted mb-2">{label}</h3>}
            <ul className="space-y-1">
              {tierPlayers.map((player) => (
                <li
                  key={player.id}
                  className={`flex items-center gap-2 py-1 px-2 rounded ${
                    player.id === currentPlayer?.id ? 'bg-primary/10' : 'hover:bg-border-subtle'
                  }`}
                >
                  <GenderIcon gender={player.gender} />
                  <span className="font-medium truncate">{player.name}</span>
                  {isAdmin && !player.email && (
                    <Tooltip label="Sin email vinculado">
                      <MailOffIcon className="w-4 h-4 text-warning" />
                    </Tooltip>
                  )}
                  {playersWithPhotos.has(player.id) && (
                    <Tooltip label="Ver fotos">
                      <button
                        onClick={() => navigate(`/galeria?player=${player.id}`)}
                        className="text-muted hover:text-primary transition-colors p-1"
                      >
                        <PhotosIcon className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  )}
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
                      <SpeakerphoneIcon className="w-4 h-4 text-gold" />
                    </Tooltip>
                  )}
                  {AWARD_TYPES.map((award) => {
                    const leaders = awardLeaders.get(award);
                    if (!leaders?.has(player.id)) return null;
                    const Icon = AWARD_ICONS[award];
                    const count = awardCounts.get(award)?.get(player.id);
                    return (
                      <Tooltip key={award} label={`Más veces ${AWARD_LABELS[award]} (${count})`}>
                        <Icon className="w-4 h-4 text-gold" />
                      </Tooltip>
                    );
                  })}
                  {showRatings && <RatingBadge rating={player.rating ?? null} pill={false} className="text-sm text-muted" />}
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
