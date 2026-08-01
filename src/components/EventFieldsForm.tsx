import type { Location } from '../types';
import type { EventFieldsState } from '../hooks/useEventFields';
import DateField from './DateField';
import LocationPicker from './LocationPicker';
import TimeInput from './TimeInput';

interface EventFieldsFormProps {
  fields: EventFieldsState;
  locations: Location[];
  /** Show the date field (only event creation sets the date). */
  showDate?: boolean;
  /** Hide cost/payee (social events have no cost split). */
  showFinances: boolean;
  namePlaceholder?: string;
  disabled?: boolean;
}

/**
 * The shared name/date/time/location/cost/payee field set used by both the
 * save-event dialog and the event detail editor, so the two forms can never
 * drift apart again.
 */
export default function EventFieldsForm({
  fields,
  locations,
  showDate = false,
  showFinances,
  namePlaceholder = 'Ej: Copa de Verano',
  disabled = false,
}: EventFieldsFormProps) {
  const inputClass = 'w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">Nombre (opcional)</label>
        <input
          type="text"
          placeholder={namePlaceholder}
          value={fields.name}
          onChange={(e) => fields.setName(e.target.value)}
          disabled={disabled}
          className={inputClass}
        />
      </div>

      {showDate && (
        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <DateField value={fields.date} onChange={fields.setDate} disabled={disabled} />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Horario</label>
        <TimeInput value={fields.time} onChange={fields.setTime} disabled={disabled} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Cancha (opcional)</label>
        <LocationPicker
          value={fields.locationSelection}
          onChange={fields.setLocationSelection}
          locations={locations}
        />
      </div>

      {showFinances && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Costo</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ej: 15000"
              value={fields.cost}
              onChange={(e) => fields.setCost(e.target.value)}
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Alias/CBU de quien pagó</label>
            <input
              type="text"
              placeholder="Alias o CBU"
              value={fields.payee}
              onChange={(e) => fields.setPayee(e.target.value)}
              disabled={disabled}
              className={inputClass}
            />
          </div>
        </>
      )}
    </>
  );
}
