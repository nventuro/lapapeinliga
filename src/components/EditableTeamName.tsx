import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ShirtColor } from '../types';
import { EditIcon, ShirtIcon, TrophyIcon } from './icons';
import Tooltip from './Tooltip';
import TeamNameColorControls from './TeamNameColorControls';

interface EditableTeamNameProps {
  name: string;
  // Omit for teams without a shirt color (tournament teams).
  shirtColor?: ShirtColor;
  isWinner?: boolean;
  // Rendered on the right of the header in display mode (e.g. team average).
  trailing?: ReactNode;
  canEdit?: boolean;
  saving?: boolean;
  // Receives the trimmed name and (for match teams) the chosen shirt color.
  onSave?: (name: string, shirtColor?: ShirtColor) => void;
}

// Team card header showing the name (+ optional shirt color) that an admin can
// edit inline. Swaps to a name input and shirt-color toggle while editing.
export default function EditableTeamName({
  name,
  shirtColor,
  isWinner = false,
  trailing,
  canEdit = false,
  saving = false,
  onSave,
}: EditableTeamNameProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftColor, setDraftColor] = useState<ShirtColor | undefined>(shirtColor);

  function startEditing() {
    setDraftName(name);
    setDraftColor(shirtColor);
    setEditing(true);
  }

  function save() {
    const trimmed = draftName.trim();
    if (trimmed === '') return;
    onSave?.(trimmed, draftColor);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 mb-3">
        <TeamNameColorControls
          name={draftName}
          onNameChange={setDraftName}
          shirtColor={draftColor}
          onShirtColorToggle={draftColor ? () => setDraftColor((c) => (c === 'light' ? 'dark' : 'light')) : undefined}
          disabled={saving}
          autoFocus
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="flex-1 py-1.5 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || draftName.trim() === ''}
            className="flex-1 py-1.5 rounded-lg text-sm font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        {isWinner && (
          <Tooltip label="Ganador">
            <TrophyIcon className="w-5 h-5 text-gold shrink-0" />
          </Tooltip>
        )}
        <h3 className="font-bold text-lg truncate">{name}</h3>
        {shirtColor && (
          <Tooltip label={shirtColor === 'light' ? 'Camiseta clara' : 'Camiseta oscura'}>
            <ShirtIcon
              className={`w-5 h-5 shrink-0 ${shirtColor === 'light' ? 'text-shirt-light' : 'text-shirt-dark'}`}
            />
          </Tooltip>
        )}
        {canEdit && onSave && (
          <Tooltip label="Editar equipo">
            <button
              type="button"
              onClick={startEditing}
              className="p-1 rounded text-muted hover:text-on-surface transition-colors shrink-0"
            >
              <EditIcon className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>
      {trailing}
    </div>
  );
}
