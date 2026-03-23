import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { EventType } from '../types';
import { COST_MARKUP_MULTIPLIER } from '../types';
import { supabase, orderEvents, buildEventLabels } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate, formatTime } from '../utils/dateUtils';
import { formatPesos, perPlayerCost } from '../utils/costUtils';
import { SoccerBallIcon, ConeIcon } from './icons';

interface MatchSubRow {
  id: number;
  winning_team_id: number | null;
  match_teams: { id: number; name: string; match_team_players: { count: number }[] }[];
  match_reserves: { count: number }[];
}

interface TrainingSubRow {
  id: number;
  training_attendees: { count: number }[];
  training_coaches: { count: number }[];
}

interface EventRow {
  id: number;
  short_id: string;
  name: string | null;
  type: EventType;
  played_at: string;
  played_at_time: string | null;
  cost: number | null;
  payee_alias_cbu: string | null;
  location: { name: string } | null;
  matches: MatchSubRow[];
  trainings: TrainingSubRow[];
}

function totalParticipants(event: EventRow): number {
  if (event.type === 'match') {
    const match = event.matches[0];
    if (!match) return 0;
    const teamPlayers = match.match_teams.reduce((sum, t) => sum + (t.match_team_players[0]?.count ?? 0), 0);
    const reserves = match.match_reserves[0]?.count ?? 0;
    return teamPlayers + reserves;
  }
  const training = event.trainings[0];
  if (!training) return 0;
  return (training.training_attendees[0]?.count ?? 0) + (training.training_coaches[0]?.count ?? 0);
}

export default function EventListPage() {
  const { isAdmin, showCosts } = useAppContext();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [labels, setLabels] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      const query = supabase
        .from('events')
        .select(`
          *,
          matches(id, winning_team_id, match_teams(id, name, match_team_players(count)), match_reserves(count)),
          trainings(id, training_attendees(count), training_coaches(count)),
          location:locations(name)
        `);
      const { data, error } = await orderEvents(query, false);

      if (error) {
        setError(error.message);
      } else if (data) {
        const rows = data as EventRow[];
        setEvents(rows);
        setLabels(buildEventLabels([...rows].reverse()));
      }
      setLoading(false);
    }
    fetchEvents();
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

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted">No hay fechas guardadas todavía.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {events.map((event) => {
          const eventLabel = labels.get(event.id) ?? '?';
          const match = event.type === 'match' ? event.matches[0] : null;
          const winnerTeam = match?.winning_team_id
            ? match.match_teams.find((t) => t.id === match.winning_team_id)
            : null;

          return (
            <Link
              key={event.id}
              to={`/fechas/${event.short_id}`}
              className="block border border-border rounded-xl p-4 hover:border-neutral-hover transition-colors"
            >
              <p className="font-medium flex items-center gap-1.5">
                #{eventLabel}
                <span className="text-muted">·</span>
                {event.type === 'match' ? (
                  <SoccerBallIcon className="w-4 h-4 text-muted" />
                ) : (
                  <ConeIcon className="w-4 h-4 text-muted" />
                )}
                <span className="text-muted text-sm">
                  {event.type === 'match' ? 'Partido' : 'Entrenamiento'}
                </span>
                {event.name && <span className="ml-1">{event.name}</span>}
                <span className="ml-1">— {formatDate(event.played_at)}</span>
              </p>
              {(event.location || event.played_at_time) && (
                <p className="text-sm text-muted mt-1">
                  {event.location?.name}
                  {event.location && event.played_at_time && ' '}
                  {event.played_at_time && formatTime(event.played_at_time)}
                </p>
              )}
              {event.type === 'match' && match && (
                <p className="text-xs text-muted mt-1.5">
                  {match.match_teams.map((t) => t.name).join(' vs ')}
                </p>
              )}
              {event.type === 'training' && (
                <p className="text-xs text-muted mt-1.5">
                  {totalParticipants(event)} participantes
                </p>
              )}
              {winnerTeam && (
                <p className="text-sm font-medium text-primary mt-1">
                  Ganador: {winnerTeam.name}
                </p>
              )}
              {isAdmin && showCosts && event.cost != null && (() => {
                const inflated = event.cost * COST_MARKUP_MULTIPLIER;
                const participants = totalParticipants(event);
                return (
                  <p className="text-xs text-muted mt-1.5 flex flex-wrap gap-x-3">
                    <span>Total: {formatPesos(event.cost)}</span>
                    <span>Inflado: {formatPesos(inflated)}</span>
                    {participants > 0 && (
                      <span>Por jugador: {formatPesos(perPlayerCost(event.cost, participants))}</span>
                    )}
                    {event.payee_alias_cbu && <span>Pagó: {event.payee_alias_cbu}</span>}
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
