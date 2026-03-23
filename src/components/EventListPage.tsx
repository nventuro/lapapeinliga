import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { EventType } from '../types';
import { COST_MARKUP_MULTIPLIER } from '../types';
import { supabase, orderEvents, buildEventLabels } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate, formatTime } from '../utils/dateUtils';
import { formatPesos, perPlayerCost } from '../utils/costUtils';
import { SoccerBallIcon, BarbellIcon } from './icons';
import Tooltip from './Tooltip';

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
  matches: MatchSubRow | null;
  trainings: TrainingSubRow | null;
}

function totalParticipants(event: EventRow): number {
  if (event.type === 'match') {
    if (!event.matches) return 0;
    const teamPlayers = event.matches.match_teams.reduce((sum, t) => sum + (t.match_team_players[0]?.count ?? 0), 0);
    const reserves = event.matches.match_reserves[0]?.count ?? 0;
    return teamPlayers + reserves;
  }
  if (!event.trainings) return 0;
  return (event.trainings.training_attendees[0]?.count ?? 0) + (event.trainings.training_coaches[0]?.count ?? 0);
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
          matches(id, winning_team_id, match_teams!match_teams_match_id_fkey(id, name, match_team_players(count)), match_reserves(count)),
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
          const match = event.type === 'match' ? event.matches : null;
          const winnerTeam = match?.winning_team_id
            ? match.match_teams.find((t) => t.id === match.winning_team_id)
            : null;

          return (
            <Link
              key={event.id}
              to={`/fechas/${event.short_id}`}
              className="flex border border-border rounded-xl hover:border-neutral-hover transition-colors"
            >
              <Tooltip label={event.type === 'match' ? 'Partido' : 'Entrenamiento'}>
                <div className="flex items-center px-3 border-r border-border text-muted">
                  {event.type === 'match' ? (
                    <SoccerBallIcon className="w-5 h-5" />
                  ) : (
                    <BarbellIcon className="w-5 h-5" />
                  )}
                </div>
              </Tooltip>
              <div className="flex-1 p-4">
                <p className="font-medium">
                  #{eventLabel}{event.name ? ` · ${event.name}` : ''} — {formatDate(event.played_at)}
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
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
