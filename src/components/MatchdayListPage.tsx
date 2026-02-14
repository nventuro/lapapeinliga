import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Matchday } from '../types';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/dateUtils';

interface MatchdayRow extends Matchday {
  teams: { id: number; name: string }[];
}

export default function MatchdayListPage() {
  const [matchdays, setMatchdays] = useState<MatchdayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatchdays() {
      const { data, error } = await supabase
        .from('matchdays')
        .select('*, teams:matchday_teams!matchday_teams_matchday_id_fkey(id, name)')
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
      <h2 className="text-xl font-bold mb-6">Fechas</h2>

      <div className="space-y-3">
        {matchdays.map((matchday) => {
          const winnerTeam = matchday.winning_team_id
            ? matchday.teams.find((t) => t.id === matchday.winning_team_id)
            : null;

          return (
            <Link
              key={matchday.id}
              to={`/matchdays/${matchday.id}`}
              className="block border border-border rounded-xl p-4 hover:border-neutral-hover transition-colors"
            >
              <p className="font-medium">{formatDate(matchday.played_at)}</p>
              <p className="text-sm text-muted mt-1">
                {matchday.teams.map((t) => t.name).join(' vs ')}
              </p>
              {winnerTeam && (
                <p className="text-sm font-medium text-primary mt-1">
                  Ganador: {winnerTeam.name}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
