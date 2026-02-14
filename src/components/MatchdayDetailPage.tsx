import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConfirmAction from './ConfirmAction';
import type { MatchdayWithDetails, Player, AwardType } from '../types';
import { effectiveRating, isGuest } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate } from '../utils/dateUtils';
import { teamAverageRating } from '../utils/scoring';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import Confetti from './Confetti';

const AWARD_LABELS: Record<AwardType, string> = {
  top_scorer: 'Goleador',
  best_defense: 'Mejor defensa',
  mvp: 'MVP',
};

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-4 h-4'}>
      <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.346A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a.75.75 0 0 0 0 1.5h12.17a.75.75 0 0 0 0-1.5h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.707 6.707 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744Zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343v.256Zm13.668 0v-.256c.674.1 1.343.214 2.006.343a5.266 5.266 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z" clipRule="evenodd" />
    </svg>
  );
}

function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-4 h-4'}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm1 2.07c1.95.3 3.64 1.33 4.76 2.81L16.2 8.4l-2.2-.6V4.07ZM11 4.07V7.8l-2.2.6-1.56-1.52A8.02 8.02 0 0 1 11 4.07ZM5.33 8.36l1.56 1.52-.6 2.2H3.55c.09-1.4.66-2.68 1.58-3.72h.2ZM3.55 13.92h2.74l.6 2.2-1.56 1.52c-.92-1.04-1.69-2.32-1.78-3.72Zm4.21 5.01 1.56-1.53 2.2.6v3.73a8.02 8.02 0 0 1-3.76-2.8Zm5.24 2.8V18l2.2-.6 1.56 1.53a8.02 8.02 0 0 1-3.76 2.8Zm5.67-5.01-1.56-1.52.6-2.2h2.74c-.09 1.4-.86 2.68-1.78 3.72Zm.78-5.56h-2.74l-.6-2.2 1.56-1.52a7.94 7.94 0 0 1 1.78 3.72ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-4 h-4'}>
      <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.016a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
    </svg>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className ?? 'w-4 h-4'}>
      <path d="M2 17l2-11 4.5 5L12 4l3.5 7L20 6l2 11H2Z" />
      <rect x="2" y="18.5" width="20" height="2.5" rx="1" />
    </svg>
  );
}

const AWARD_ICONS: Record<AwardType, typeof TrophyIcon> = {
  top_scorer: SoccerBallIcon,
  best_defense: ShieldIcon,
  mvp: CrownIcon,
};

async function fetchMatchdayData(
  id: string,
  players: Player[],
): Promise<MatchdayWithDetails | null> {
  const { data: matchdayData, error: matchdayError } = await supabase
    .from('matchdays')
    .select('*')
    .eq('id', id)
    .single();

  if (matchdayError || !matchdayData) return null;

  const { data: teamsData } = await supabase
    .from('matchday_teams')
    .select('id, matchday_id, name')
    .eq('matchday_id', id)
    .order('id');

  const { data: teamPlayersData } = await supabase
    .from('matchday_team_players')
    .select('matchday_team_id, player_id')
    .in('matchday_team_id', (teamsData ?? []).map((t) => t.id));

  const { data: reservesData } = await supabase
    .from('matchday_reserves')
    .select('player_id')
    .eq('matchday_id', id);

  const playerMap = new Map(players.map((p) => [p.id, p]));

  const teams = (teamsData ?? []).map((team) => ({
    ...team,
    players: (teamPlayersData ?? [])
      .filter((tp) => tp.matchday_team_id === team.id)
      .map((tp) => playerMap.get(tp.player_id))
      .filter((p): p is Player => p !== undefined),
  }));

  const reserves = (reservesData ?? [])
    .map((r) => playerMap.get(r.player_id))
    .filter((p): p is Player => p !== undefined);

  return {
    ...matchdayData,
    teams,
    reserves,
  } as MatchdayWithDetails;
}

export default function MatchdayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { players, isAdmin } = useAppContext();

  const [matchday, setMatchday] = useState<MatchdayWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allParticipants = matchday
    ? [
        ...matchday.teams.flatMap((t) => t.players),
        ...matchday.reserves,
      ]
    : [];

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const data = await fetchMatchdayData(id!, players);
      if (!cancelled) {
        setMatchday(data);
        setLoading(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [id, players]);

  async function handleWinnerChange(teamId: number | null) {
    if (!matchday) return;
    setSaving(true);

    const { error } = await supabase
      .from('matchdays')
      .update({ winning_team_id: teamId })
      .eq('id', matchday.id);

    if (!error) {
      setMatchday({ ...matchday, winning_team_id: teamId });
    }
    setSaving(false);
  }

  async function handleAwardChange(award: AwardType, playerId: number | null) {
    if (!matchday) return;
    setSaving(true);

    const field = `${award}_id`;
    const { error } = await supabase
      .from('matchdays')
      .update({ [field]: playerId })
      .eq('id', matchday.id);

    if (!error) {
      setMatchday({ ...matchday, [`${award}_id`]: playerId });
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!matchday) return;

    const { error } = await supabase
      .from('matchdays')
      .delete()
      .eq('id', matchday.id);

    if (error) {
      alert(`Error al eliminar: ${error.message}`);
      return;
    }

    navigate('/');
  }

  if (loading) {
    return <p className="text-muted text-center py-8">Cargando fecha...</p>;
  }

  if (!matchday) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">No se encontró la fecha.</p>
      </div>
    );
  }

  const winnerTeam = matchday.winning_team_id
    ? matchday.teams.find((t) => t.id === matchday.winning_team_id)
    : null;

  // Build a map of player ID → list of awards they hold
  const playerAwards = new Map<number, AwardType[]>();
  for (const award of ['top_scorer', 'best_defense', 'mvp'] as AwardType[]) {
    const pid = matchday[`${award}_id`];
    if (pid) {
      const existing = playerAwards.get(pid) ?? [];
      existing.push(award);
      playerAwards.set(pid, existing);
    }
  }

  function getPlayerName(playerId: number | null): string {
    if (!playerId) return '';
    return players.find((p) => p.id === playerId)?.name ?? '';
  }

  return (
    <div>
      <h2 className="text-xl font-bold">
        {formatDate(matchday.played_at)}
      </h2>

      {/* Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {matchday.teams.map((team) => {
          const isWinner = team.id === matchday.winning_team_id;
          return (
            <div
              key={team.id}
              className={`relative overflow-hidden rounded-lg p-4 ${
                isWinner ? 'border-2 border-gold bg-gold-subtle' : 'border border-border'
              }`}
            >
              {isWinner && <Confetti />}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {isWinner && <TrophyIcon className="w-5 h-5 text-gold" />}
                  <h3 className="font-bold text-lg">{team.name}</h3>
                </div>
                {isAdmin && (
                  <span className="text-sm text-muted">
                    Promedio: {teamAverageRating(team).toFixed(1)}
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {[...team.players].sort((a, b) => effectiveRating(b) - effectiveRating(a)).map((player) => {
                  const awards = playerAwards.get(player.id);
                  return (
                    <li key={player.id} className="flex items-center gap-2 py-1 px-2">
                      <GenderIcon gender={player.gender} />
                      <span>{player.name}</span>
                      {isGuest(player) && <InvBadge />}
                      {awards?.map((award) => {
                        const Icon = AWARD_ICONS[award];
                        return (
                          <span key={award} className="text-gold" title={AWARD_LABELS[award]}>
                            <Icon className="w-4 h-4" />
                          </span>
                        );
                      })}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 pt-2 border-t border-border-subtle text-sm text-muted">
                {team.players.length} jugador{team.players.length !== 1 ? 'es' : ''}
              </p>
            </div>
          );
        })}
      </div>

      {/* Reserves */}
      {matchday.reserves.length > 0 && (
        <div className="border border-border rounded-lg p-4 mt-4">
          <h3 className="font-bold text-lg mb-3">
            Suplentes
            <span className="font-normal text-sm text-muted ml-2">
              ({matchday.reserves.length})
            </span>
          </h3>
          <ul className="space-y-1">
            {matchday.reserves.map((player) => (
              <li key={player.id} className="flex items-center gap-2 py-1 px-2">
                <GenderIcon gender={player.gender} />
                <span>{player.name}</span>
                {isGuest(player) && <InvBadge />}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Results section */}
      <div className="border border-border rounded-lg p-4 mt-4">
        <h3 className="font-bold text-lg mb-4">Resultados</h3>

        {isAdmin ? (
          <div className="space-y-4">
            {/* Winner picker */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                Ganador
                <TrophyIcon className="w-4 h-4 text-gold" />
              </label>
              <select
                value={matchday.winning_team_id ?? ''}
                onChange={(e) =>
                  handleWinnerChange(e.target.value ? Number(e.target.value) : null)
                }
                disabled={saving}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Sin definir</option>
                {[...matchday.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Award pickers */}
            {(['top_scorer', 'best_defense', 'mvp'] as AwardType[]).map((award) => {
              const Icon = AWARD_ICONS[award];
              return (
              <div key={award}>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-1">
                  {AWARD_LABELS[award]}
                  <Icon className="w-4 h-4 text-gold" />
                </label>
                <select
                  value={matchday[`${award}_id`] ?? ''}
                  onChange={(e) =>
                    handleAwardChange(award, e.target.value ? Number(e.target.value) : null)
                  }
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Sin definir</option>
                  {[...allParticipants].sort((a, b) => a.name.localeCompare(b.name)).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted">
                Ganador
                <TrophyIcon className="w-4 h-4 text-gold" />
              </span>
              <span className="font-medium">
                {winnerTeam ? winnerTeam.name : 'Sin definir'}
              </span>
            </div>
            {(['top_scorer', 'best_defense', 'mvp'] as AwardType[]).map((award) => {
              const Icon = AWARD_ICONS[award];
              return (
                <div key={award} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-muted">
                    {AWARD_LABELS[award]}
                    <Icon className="w-4 h-4 text-gold" />
                  </span>
                  <span className="font-medium">
                    {getPlayerName(matchday[`${award}_id`]) || 'Sin definir'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isAdmin && (
        <ConfirmAction
          label="Eliminar fecha"
          message="¿Eliminar esta fecha? Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          className="mt-6"
        />
      )}
    </div>
  );
}
