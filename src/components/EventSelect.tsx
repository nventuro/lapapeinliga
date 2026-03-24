import type { Event } from '../types';

interface EventSelectProps {
  events: Event[];
  eventLabels: Map<number, string>;
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
}

export default function EventSelect({ events, eventLabels, value, onChange, emptyLabel = 'Todas las fechas' }: EventSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-on-surface"
    >
      <option value="">{emptyLabel}</option>
      {events.map((event) => (
        <option key={event.id} value={event.id}>
          Fecha {eventLabels.get(event.id) ?? event.id}{event.name ? ` — ${event.name}` : ''} ({event.played_at})
        </option>
      ))}
    </select>
  );
}
