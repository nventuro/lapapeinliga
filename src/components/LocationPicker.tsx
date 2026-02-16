import type { Location, LocationSelection } from '../types';
import { isValidMapsUrl } from '../types';

const NEW_LOCATION_VALUE = '__new__';

interface LocationPickerProps {
  value: LocationSelection;
  onChange: (selection: LocationSelection) => void;
  locations: Location[];
}

export default function LocationPicker({ value, onChange, locations }: LocationPickerProps) {
  const selectValue =
    value.type === 'none'
      ? ''
      : value.type === 'existing'
        ? String(value.locationId)
        : NEW_LOCATION_VALUE;

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === '') {
      onChange({ type: 'none' });
    } else if (v === NEW_LOCATION_VALUE) {
      onChange({ type: 'new', name: '', mapsUrl: '' });
    } else {
      onChange({ type: 'existing', locationId: Number(v) });
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={handleSelectChange}
        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Sin cancha</option>
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
        <option value={NEW_LOCATION_VALUE}>Agregar nueva cancha...</option>
      </select>

      {value.type === 'new' && (
        <div className="space-y-2 pl-3 border-l-2 border-primary">
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Nombre"
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value.mapsUrl}
              onChange={(e) => onChange({ ...value, mapsUrl: e.target.value })}
              placeholder="Link de Google Maps"
              className={`flex-1 px-3 py-2 rounded-lg border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm ${value.mapsUrl && !isValidMapsUrl(value.mapsUrl) ? 'border-error' : 'border-border'}`}
            />
            {value.mapsUrl && isValidMapsUrl(value.mapsUrl) && (
              <a
                href={value.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-hover text-sm shrink-0"
              >
                Ver mapa
              </a>
            )}
          </div>
          {value.mapsUrl && !isValidMapsUrl(value.mapsUrl) && (
            <p className="text-xs text-error">El link debe empezar con https://</p>
          )}
        </div>
      )}
    </div>
  );
}
