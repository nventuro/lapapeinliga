import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConfirmAction from './ConfirmAction';
import type { MatchdayWithDetails, Player, AwardType } from '../types';
import { effectiveRating, isGuest } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate } from '../utils/dateUtils';
import { teamAverageRating } from '../utils/scoring';
import { TrophyIcon, SoccerBallIcon, ShieldIcon, CrownIcon } from './icons';
import GenderIcon from './GenderIcon';
import InvBadge from './InvBadge';
import Confetti from './Confetti';

const AWARD_LABELS: Record<AwardType, string> = {
  top_scorer: 'Goleador',
  best_defense: 'Mejor defensa',
  mvp: 'MVP',
};

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
