import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { EventFinances, EventType } from '../types';
import { EVENT_TYPE_LABELS, EXTERNAL_RESULT_LABELS, OUR_TEAM_NAME, externalMatchResult } from '../types';
import { supabase, orderEvents, buildEventLabels } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { formatDate, formatTime } from '../utils/dateUtils';
import CostSummary from './CostSummary';
import { EVENT_TYPE_ICONS } from './eventTypeIcons';
import Tooltip from './Tooltip';

interface EventRow {
  id: number;
  short_id: string;
  name: string | null;
  type: EventType;
  played_at: string;
  played_at_time: string;
  winning_team_id: number | null;
  finances: EventFinances | null;
  location: { name: string } | null;
  event_teams: { id: number; name: string }[];
  event_participants: { count: number }[];
  external_matches: {
    our_score: number | null;
    their_score: number | null;
    external_team: { name: string } | null;
  } | null;
}

// Finances live in the mod/admin-only event_finances table; PostgREST embeds
// it (null for non-mods via RLS).
type RawEventRow = Omit<EventRow, 'finances'> & {
  event_finances: EventFinances | null;
};

export default function EventListPage() {
  const { isAdmin, showCosts } = useAppContext();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [labels, setLabels] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      // The events→event_teams embed needs the FK hint because the winner FK
      // on events creates a second relationship between the two tables.
      const query = supabase
        .from('events')
        .select(`
          *,
          event_finances(cost, payee_alias_cbu),
          event_teams!event_teams_event_id_fkey(id, name),
          event_participants(count),
          external_matches(our_score, their_score, external_team:external_teams(name)),
          location:locations(name)
        `);
      const { data, error } = await orderEvents(query, false);

      if (error) {
        setError(error.message);
      } else if (data) {
        const rows: EventRow[] = (data as RawEventRow[]).map(
          ({ event_finances, ...rest }) => ({ ...rest, finances: event_finances }),
        );
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
          const participantCount = event.event_participants[0]?.count ?? 0;
          const externalMatch = event.type === 'external_match' ? event.external_matches : null;
          const externalResult = externalMatch
            ? externalMatchResult(externalMatch.our_score, externalMatch.their_score)
            : null;
          const winnerTeam = event.winning_team_id != null
            ? event.event_teams.find((t) => t.id === event.winning_team_id)
            : null;
          const TypeIcon = EVENT_TYPE_ICONS[event.type];

          return (
            <Link
              key={event.id}
              to={`/fechas/${event.short_id}`}
              className="flex bg-surface border border-border rounded-xl hover:border-neutral-hover transition-colors"
            >
              <Tooltip label={EVENT_TYPE_LABELS[event.type]}>
                <div className="flex flex-col items-center justify-center gap-1 px-3 border-r border-border text-muted min-w-14">
                  <span className="text-xs font-semibold">#{eventLabel}</span>
                  <TypeIcon className="w-5 h-5" />
                </div>
              </Tooltip>
              <div className="flex-1 p-4">
                <p className="font-medium">
                  {event.name ?? formatDate(event.played_at)}
                </p>
                {event.name && (
                  <p className="text-sm text-muted mt-0.5">
                    {formatDate(event.played_at)}
                  </p>
                )}
                <p className="text-sm text-muted mt-1">
                  {event.location ? `${event.location.name} · ` : ''}{formatTime(event.played_at_time)}
                </p>
                {event.type === 'match' && event.event_teams.length > 0 && (
                  <p className="text-xs text-muted mt-1.5">
                    {event.event_teams.map((t) => t.name).join(' vs ')}
                  </p>
                )}
                {event.type === 'tournament' && event.event_teams.length > 0 && (
                  <p className="text-xs text-muted mt-1.5">
                    {event.event_teams.map((t) => t.name).join(' / ')}
                  </p>
                )}
                {event.type === 'external_match' && externalMatch && (
                  <p className="text-xs text-muted mt-1.5">
                    {OUR_TEAM_NAME} vs {externalMatch.external_team?.name ?? 'Rival'}
                  </p>
                )}
                {event.type === 'training' && (
                  <p className="text-xs text-muted mt-1.5">
                    {participantCount} participantes
                  </p>
                )}
                {winnerTeam && (
                  <p className="text-sm font-medium text-accent mt-1">
                    Ganador: {winnerTeam.name}
                  </p>
                )}
                {externalMatch && externalResult && (
                  <p className={`text-sm font-medium mt-1 ${externalResult === 'win' ? 'text-success' : externalResult === 'loss' ? 'text-error' : 'text-info'}`}>
                    {EXTERNAL_RESULT_LABELS[externalResult]} {externalMatch.our_score} - {externalMatch.their_score}
                  </p>
                )}
              {isAdmin && showCosts && (
                <CostSummary finances={event.finances} participantCount={participantCount} className="text-xs mt-1.5" />
              )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
