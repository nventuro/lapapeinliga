import type { ExternalTeam, ExternalTeamSelection } from '../types';

const NEW_TEAM_VALUE = '__new__';

interface ExternalTeamPickerProps {
  value: ExternalTeamSelection;
  onChange: (selection: ExternalTeamSelection) => void;
  teams: ExternalTeam[];
}

export default function ExternalTeamPicker({ value, onChange, teams }: ExternalTeamPickerProps) {
  const selectValue =
    value.type === 'none'
      ? ''
      : value.type === 'existing'
        ? String(value.externalTeamId)
        : NEW_TEAM_VALUE;

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === '') {
      onChange({ type: 'none' });
    } else if (v === NEW_TEAM_VALUE) {
      onChange({ type: 'new', name: '' });
    } else {
      onChange({ type: 'existing', externalTeamId: Number(v) });
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={handleSelectChange}
        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Elegí el rival</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
        <option value={NEW_TEAM_VALUE}>Agregar nuevo rival...</option>
      </select>

      {value.type === 'new' && (
        <div className="pl-3 border-l-2 border-primary">
          <input
            type="text"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Nombre del rival"
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>
      )}
    </div>
  );
}
