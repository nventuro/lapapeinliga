import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { EventFinances, EventType } from '../types';
import { EVENT_TYPE_LABELS, EXTERNAL_RESULT_LABELS, OUR_TEAM_NAME, externalMatchResult } from '../types';
import { supabase, orderEvents, buildEventLabels } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import {
  formatDate,
  formatDayMonthShort,
  formatMonthYear,
  formatTime,
  hasStarted,
  relativeDayLabel,
} from '../utils/dateUtils';
import CostSummary from './CostSummary';
import EventListSkeleton from './EventListSkeleton';
import { EVENT_TYPE_ICONS } from './eventTypeIcons';
import Tooltip from './Tooltip';
import Chip, { ChipRow } from './Chip';
import SectionLabel from './SectionLabel';

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
    our_penalties: number | null;
    their_penalties: number | null;
    external_team: { name: string } | null;
  } | null;
}

// Finances live in the mod/admin-only event_finances table; PostgREST embeds
// it (null for non-mods via RLS).
type RawEventRow = Omit<EventRow, 'finances'> & {
  event_finances: EventFinances | null;
};

/**
 * A recorded outcome outranks the clock: an event with a result belongs in the
 * history even if its date says otherwise. Covers a fixture brought forward,
 * one that was called off, and a date entered wrong.
 */
function hasResult(event: EventRow): boolean {
  if (event.winning_team_id != null) return true;
  const external = event.external_matches;
  return external != null && external.our_score != null && external.their_score != null;
}

function isUpcoming(event: EventRow): boolean {
  return !hasResult(event) && !hasStarted(event.played_at, event.played_at_time);
}

function participantsOf(event: EventRow): number {
  return event.event_participants[0]?.count ?? 0;
}

/** Who is playing. Absent for an internal match until the teams are drawn. */
function lineupOf(event: EventRow): string | null {
  const names = event.event_teams.map((t) => t.name);
  if (event.type === 'match' && names.length > 0) return names.join(' vs ');
  if (event.type === 'tournament' && names.length > 0) return names.join(' / ');
  if (event.type === 'external_match' && event.external_matches) {
    return `${OUR_TEAM_NAME} vs ${event.external_matches.external_team?.name ?? 'Rival'}`;
  }
  return null;
}

/** Stands in for the name in the agenda strip when an event has none. */
function fallbackTitle(event: EventRow): string {
  if (event.type === 'external_match') {
    return `vs ${event.external_matches?.external_team?.name ?? 'Rival'}`;
  }
  if (event.type === 'training') return 'Entrenamiento';
  if (event.type === 'tournament') return 'Torneo';
  if (event.type === 'social') return 'Evento';
  return event.location?.name ?? EVENT_TYPE_LABELS[event.type];
}

/**
 * Before kickoff the roster count answers "are we enough yet?"; afterwards the
 * outcome is the story and the count moves to the detail page. A training is the
 * exception -- it has no result, so the turnout *is* the outcome.
 */
function EventChips({ event }: { event: EventRow }) {
  const count = participantsOf(event);
  const upcoming = isUpcoming(event);

  if (upcoming) {
    return count > 0 ? <ChipRow><Chip tone="info">{count} anotados</Chip></ChipRow> : null;
  }

  if (event.type === 'training') {
    return count > 0 ? <ChipRow><Chip tone="neutral">{count} participantes</Chip></ChipRow> : null;
  }

  const winnerTeam = event.winning_team_id != null
    ? event.event_teams.find((t) => t.id === event.winning_team_id)
    : null;
  if (winnerTeam) {
    return <ChipRow><Chip tone="win">Ganó {winnerTeam.name}</Chip></ChipRow>;
  }

  const externalMatch = event.type === 'external_match' ? event.external_matches : null;
  const externalResult = externalMatch
    ? externalMatchResult(externalMatch.our_score, externalMatch.their_score, externalMatch.our_penalties, externalMatch.their_penalties)
    : null;
  if (externalMatch && externalResult) {
    // The chip is too small for "por penales": collapse to the base label and
    // append the shootout score instead.
    const baseResult = externalResult === 'win_penalties' ? 'win'
      : externalResult === 'loss_penalties' ? 'loss'
      : externalResult;
    const penalties = externalMatch.our_penalties != null
      ? ` (${externalMatch.our_penalties}-${externalMatch.their_penalties} p)`
      : '';
    return (
      <ChipRow>
        <Chip tone={baseResult === 'win' ? 'win' : baseResult === 'loss' ? 'loss' : 'info'}>
          {EXTERNAL_RESULT_LABELS[baseResult]} {externalMatch.our_score} - {externalMatch.their_score}{penalties}
        </Chip>
      </ChipRow>
    );
  }

  return null;
}

/**
 * Title, date, place and lineup -- identical wording wherever an event is shown.
 *
 * `showLogistics` gates the place · time line. It answers "where do I have to
 * be, and when" -- a question that expires at kickoff -- so the history rows
 * drop it and the line lives on only where it is still ahead: the next-date
 * card, the agenda strip, and the detail page.
 */
function EventSummary({ event, titleClassName, showLogistics = true }: {
  event: EventRow;
  titleClassName: string;
  showLogistics?: boolean;
}) {
  const lineup = lineupOf(event);
  return (
    <>
      <p className={titleClassName}>{event.name ?? formatDate(event.played_at)}</p>
      {event.name && <p className="text-sm text-muted mt-0.5">{formatDate(event.played_at)}</p>}
      {showLogistics && (
        <p className="text-sm text-muted mt-1">
          {event.location ? `${event.location.name} · ` : ''}{formatTime(event.played_at_time)}
        </p>
      )}
      {lineup && <p className="text-sm text-muted mt-1">{lineup}</p>}
    </>
  );
}

function EventCost({ event, className }: { event: EventRow; className: string }) {
  const { isAdmin, showCosts } = useAppContext();
  if (!isAdmin || !showCosts) return null;
  return <CostSummary finances={event.finances} participantCount={participantsOf(event)} className={className} />;
}

/**
 * The card's left rail: the event number over its type icon. Every card in the
 * list carries one at the same width, so the titles and dates share a single
 * left edge all the way down the page.
 *
 * Only the icon is wrapped in the `Tooltip`: that renders an `inline-flex`
 * span, and wrapping the whole rail in it stopped the rail from stretching to
 * the card's height, leaving the divider hanging short of both corners.
 */
function EventRail({ event, label, className }: { event: EventRow; label: string; className: string }) {
  const TypeIcon = EVENT_TYPE_ICONS[event.type];
  return (
    <div className={`flex flex-col items-center justify-center gap-1 px-3 border-r min-w-14 ${className}`}>
      <span className="text-xs font-semibold">#{label}</span>
      <Tooltip label={EVENT_TYPE_LABELS[event.type]}>
        <TypeIcon className="w-5 h-5" />
      </Tooltip>
    </div>
  );
}

function NextEventCard({ event, label }: { event: EventRow; label: string }) {
  return (
    <Link
      to={`/fechas/${event.short_id}`}
      className="flex bg-surface border border-accent-border rounded-xl overflow-hidden shadow-sm hover:border-accent transition-colors"
    >
      {/* Sharing the rail is what puts this card on the same left edge as the
          history below it, so what marks it as the next date has to be color
          rather than shape -- hence the crest celeste on the rail. */}
      <EventRail event={event} label={label} className="bg-celeste border-celeste text-on-celeste" />
      <div className="flex-1 p-4">
        <EventSummary event={event} titleClassName="font-bold text-lg leading-tight" />
        <EventChips event={event} />
        <EventCost event={event} className="text-xs mt-2" />
      </div>
    </Link>
  );
}

function EventRowLink({ event, label }: { event: EventRow; label: string }) {
  return (
    <Link
      to={`/fechas/${event.short_id}`}
      className="flex bg-surface border border-border rounded-xl overflow-hidden hover:border-neutral-hover transition-colors"
    >
      <EventRail event={event} label={label} className="border-border text-muted" />
      <div className="flex-1 p-4">
        <EventSummary event={event} titleClassName="font-medium" showLogistics={false} />
        <EventChips event={event} />
        <EventCost event={event} className="text-xs mt-2" />
      </div>
    </Link>
  );
}

/** One line per event: when, and one thing more. The icon carries the type. */
function AgendaLine({ event }: { event: EventRow }) {
  const TypeIcon = EVENT_TYPE_ICONS[event.type];
  return (
    <Link
      to={`/fechas/${event.short_id}`}
      className="flex items-center gap-2.5 px-3 py-2.5 text-sm border-b border-border-subtle last:border-b-0 hover:bg-border-subtle transition-colors"
    >
      <Tooltip label={EVENT_TYPE_LABELS[event.type]}>
        <TypeIcon className="w-4 h-4 text-muted" />
      </Tooltip>
      <span className="font-semibold whitespace-nowrap">
        {formatDayMonthShort(event.played_at)} · {formatTime(event.played_at_time)}
      </span>
      <span className="text-muted truncate">{event.name ?? fallbackTitle(event)}</span>
    </Link>
  );
}

export default function EventListPage() {
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
          external_matches(our_score, their_score, our_penalties, their_penalties, external_team:external_teams(name)),
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
    return <EventListSkeleton />;
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

  const labelOf = (event: EventRow) => labels.get(event.id) ?? '?';

  // The query sorts newest first, which is what the history wants; what is still
  // to come reads better soonest-first. Sorted outright rather than reversed so
  // the order holds on its own instead of riding on the query's.
  const upcoming: EventRow[] = [];
  const past: EventRow[] = [];
  for (const event of events) {
    (isUpcoming(event) ? upcoming : past).push(event);
  }
  upcoming.sort((a, b) =>
    a.played_at.localeCompare(b.played_at)
    || a.played_at_time.localeCompare(b.played_at_time)
    || a.id - b.id,
  );
  const [nextEvent, ...laterEvents] = upcoming;

  // Past events already arrive in date order, so a month closes as soon as the
  // next one starts -- no sorting or keying needed.
  const pastByMonth: { key: string; label: string; events: EventRow[] }[] = [];
  for (const event of past) {
    const key = event.played_at.slice(0, 7);
    const current = pastByMonth[pastByMonth.length - 1];
    if (current?.key === key) current.events.push(event);
    else pastByMonth.push({ key, label: formatMonthYear(event.played_at), events: [event] });
  }

  return (
    <div className="space-y-6">
      {nextEvent && (
        <section>
          <SectionLabel>
            <span className="text-lime-strong">★</span>
            PRÓXIMA FECHA — {relativeDayLabel(nextEvent.played_at).toUpperCase()}
          </SectionLabel>
          <NextEventCard event={nextEvent} label={labelOf(nextEvent)} />
        </section>
      )}

      {laterEvents.length > 0 && (
        <section>
          <SectionLabel dim>DESPUÉS</SectionLabel>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {laterEvents.map((event) => (
              <AgendaLine key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {pastByMonth.map(({ key, label, events: monthEvents }) => (
        <section key={key}>
          <SectionLabel dim>{label.toUpperCase()}</SectionLabel>
          <div className="space-y-3">
            {monthEvents.map((event) => (
              <EventRowLink key={event.id} event={event} label={labelOf(event)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
