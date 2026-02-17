import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Matchday } from '../types';
import { COST_MARKUP_MULTIPLIER } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate, formatTime } from '../utils/dateUtils';
import { formatPesos, perPlayerCost } from '../utils/costUtils';

interface MatchdayRow extends Matchday {
  teams: { id: number; name: string; matchday_team_players: { count: number }[] }[];
  location: { name: string } | null;
  matchday_reserves: { count: number }[];
}

function totalParticipants(matchday: MatchdayRow): number {
  const teamPlayers = matchday.teams.reduce((sum, t) => sum + (t.matchday_team_players[0]?.count ?? 0), 0);
  const reserves = matchday.matchday_reserves[0]?.count ?? 0;
  return teamPlayers + reserves;
}

export default function MatchdayListPage() {
  const { isAdmin, showCosts } = useAppContext();
  const [matchdays, setMatchdays] = useState<MatchdayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatchdays() {
      const { data, error } = await supabase
        .from('matchdays')
        .select('*, teams:matchday_teams!matchday_teams_matchday_id_fkey(id, name, matchday_team_players(count)), matchday_reserves(count), location:locations(name)')
        .order('played_at', { ascending: false });

      if (error) {
        setError(error.message);
      } else if (data) {
        setMatchdays(data as MatchdayRow[]);
      }
      setLoading(false);
    }
    fetchMatchdays();
  }, []);

  if (loading) {
    return <p className="text-muted text-center py-8">Cargando fechas...</p>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-error">Error al cargar fechas: {error}</p>
      </div>
    );
  }

  if (matchdays.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">No hay fechas guardadas todavía.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {matchdays.map((matchday, index) => {
          const matchdayNumber = matchdays.length - index;
          const winnerTeam = matchday.winning_team_id
            ? matchday.teams.find((t) => t.id === matchday.winning_team_id)
            : null;

          return (
            <Link
              key={matchday.id}
              to={`/fechas/${matchday.short_id}`}
              className="block border border-border rounded-xl p-4 hover:border-neutral-hover transition-colors"
            >
              <p className="font-medium">
                #{matchdayNumber} — {formatDate(matchday.played_at)}
              </p>
              {(matchday.location || matchday.played_at_time) && (
                <p className="text-sm text-muted mt-1">
                  {matchday.location?.name}
                  {matchday.location && matchday.played_at_time && ' '}
                  {matchday.played_at_time && formatTime(matchday.played_at_time)}
                </p>
              )}
              <p className="text-xs text-muted mt-1.5">
                {matchday.teams.map((t) => t.name).join(' vs ')}
              </p>
              {winnerTeam && (
                <p className="text-sm font-medium text-primary mt-1">
                  Ganador: {winnerTeam.name}
                </p>
              )}
              {isAdmin && showCosts && matchday.cost != null && (() => {
                const inflated = matchday.cost * COST_MARKUP_MULTIPLIER;
                const participants = totalParticipants(matchday);
                return (
                  <p className="text-xs text-muted mt-1.5 flex flex-wrap gap-x-3">
                    <span>Total: {formatPesos(matchday.cost)}</span>
                    <span>Inflado: {formatPesos(inflated)}</span>
                    {participants > 0 && (
                      <span>Por jugador: {formatPesos(perPlayerCost(matchday.cost, participants))}</span>
                    )}
                    {matchday.payee_alias_cbu && <span>Pagó: {matchday.payee_alias_cbu}</span>}
                  </p>
                );
              })()}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
