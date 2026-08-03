import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

/** The one-line record that sits under a name in the roster. */
function playerSummary(played: number, won: number): string {
  if (played === 0) return 'Sin partidos todavía';
  const games = `${played} partido${played !== 1 ? 's' : ''}`;
  return `${games} · ${Math.round((won / played) * 100)}% efectividad`;
}

export default function PlantelPage() {
  const navigate = useNavigate();
  const { players, isAdmin, showRatings, refetchData } = useAppContext();
  const currentPlayer = useCurrentPlayer();
  const { gamesPlayed, gamesWon, awardCounts, trainingsAttended, trainingsCoached, loading: statsLoading } = useEventStats();
  const [modalPlayer, setModalPlayer] = useState<Player | null | undefined>(undefined);
  // undefined = closed, null = creating, Player = editing
  const [search, setSearch] = useState('');

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

  const query = search.trim().toLowerCase();
  const matching = query ? players.filter((p) => p.name.toLowerCase().includes(query)) : players;
  const groups = groupPlayersForRoster(matching, isAdmin);

  return (
    <div>
      {isAdmin && (
        <div className="flex items-center justify-center gap-3 mb-4">
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

      <div className="flex items-center gap-2 mb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar jugador..."
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {/* Saves scrolling the whole roster to find yourself. */}
        {currentPlayer && (
          <Link
            to={`/plantel/${currentPlayer.id}`}
            className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-lime-subtle text-on-lime border border-lime hover:bg-lime transition-colors"
          >
            Mi ficha
          </Link>
        )}
      </div>

      {/* Every other page puts its content on a surface; the roster was the one
          list left sitting bare on the page ground. */}
      {groups.map(({ key, label, players: tierPlayers }, index) => {
        return (
          <div key={key} className={`bg-surface border border-border rounded-lg p-4 ${index > 0 ? 'mt-3' : ''}`}>
            {label && <h3 className="text-sm font-semibold text-muted mb-2">{label}</h3>}
            <ul className="space-y-1">
              {tierPlayers.map((player) => {
                const isMe = player.id === currentPlayer?.id;
                return (
                  <li
                    key={player.id}
                    /* A tint alone cannot mark your own row: every shade pale
                       enough to sit under text lands within ~1.1 contrast of the
                       hover tint. The lime edge carries it, the fill supports. */
                    className={`flex items-center gap-1 rounded border-l-[3px] ${
                      isMe ? 'border-lime bg-lime-subtle' : 'border-transparent hover:bg-border-subtle'
                    }`}
                  >
                    <Link
                      to={`/plantel/${player.id}`}
                      className="flex items-center gap-2 flex-1 min-w-0 py-1 px-2"
                    >
                      <GenderIcon gender={player.gender} />
                      <span className="min-w-0">
                        <span className="font-medium truncate block">{player.name}</span>
                        <span className="text-xs text-muted truncate block">
                          {playerSummary(gamesPlayed.get(player.id) ?? 0, gamesWon.get(player.id) ?? 0)}
                        </span>
                      </span>
                      {isMe && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-lime text-on-lime">
                          VOS
                        </span>
                      )}
                    </Link>

                    {/* Controls sit outside the link so they stay independently
                        clickable rather than nested inside it. */}
                    <div className="flex items-center gap-1 shrink-0 pr-2">
                      {isAdmin && !player.email && (
                        <Tooltip label="Sin email vinculado">
                          <MailOffIcon className="w-4 h-4 text-warning" />
                        </Tooltip>
                      )}
                      {mostWonIds.has(player.id) && (
                        <Tooltip label={`Más partidos ganados (${gamesWon.get(player.id)})`}>
                          <TrophyIcon className="w-4 h-4 text-lime-strong" />
                        </Tooltip>
                      )}
                      {mostPlayedIds.has(player.id) && (
                        <Tooltip label={`Más partidos jugados (${gamesPlayed.get(player.id)})`}>
                          <SneakerIcon className="w-4 h-4 text-lime-strong" />
                        </Tooltip>
                      )}
                      {mostTrainedIds.has(player.id) && (
                        <Tooltip label={`Más entrenamientos asistidos (${trainingsAttended.get(player.id)})`}>
                          <BarbellIcon className="w-4 h-4 text-lime-strong" />
                        </Tooltip>
                      )}
                      {mostCoachedIds.has(player.id) && (
                        <Tooltip label={`Más entrenamientos dirigidos (${trainingsCoached.get(player.id)})`}>
                          <SpeakerphoneIcon className="w-4 h-4 text-lime-strong" />
                        </Tooltip>
                      )}
                      {AWARD_TYPES.map((award) => {
                        const leaders = awardLeaders.get(award);
                        if (!leaders?.has(player.id)) return null;
                        const Icon = AWARD_ICONS[award];
                        const count = awardCounts.get(award)?.get(player.id);
                        return (
                          <Tooltip key={award} label={`Más veces ${AWARD_LABELS[award]} (${count})`}>
                            <Icon className="w-4 h-4 text-lime-strong" />
                          </Tooltip>
                        );
                      })}
                      {showRatings && <RatingBadge rating={player.rating ?? null} pill={false} className="text-sm text-muted" />}
                      {isAdmin && (
                        <>
                          <Tooltip label="Editar jugador">
                            <button
                              onClick={() => setModalPlayer(player)}
                              className="text-muted hover:text-accent transition-colors p-1"
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
                        </>
                      )}
                      {playersWithPhotos.has(player.id) && (
                        <Tooltip label="Ver fotos">
                          <button
                            onClick={() => navigate(`/galeria?player=${player.id}`)}
                            className="text-muted hover:text-accent transition-colors p-1"
                          >
                            <PhotosIcon className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {players.length === 0 && (
        <p className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted">
          No hay jugadores cargados.{isAdmin && ' Agregá el primero.'}
        </p>
      )}

      {players.length > 0 && matching.length === 0 && (
        <p className="bg-surface border border-border rounded-lg px-4 py-8 text-center text-muted">
          No hay ningún jugador con ese nombre.
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
