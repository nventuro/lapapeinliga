import type { ShirtColor } from '../types';
import { ShirtIcon, ShuffleIcon } from './icons';
import Tooltip from './Tooltip';

interface TeamNameColorControlsProps {
  name: string;
  onNameChange: (value: string) => void;
  // Omit to hide the shirt-color toggle entirely (e.g. tournament teams have no shirt color).
  shirtColor?: ShirtColor;
  onShirtColorToggle?: () => void;
  // Omit to hide the randomize button (only the create flow offers suggested names).
  onRandomize?: () => void;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}

// Shared name input + optional randomize + optional shirt-color toggle row.
// Used both when creating an event (SaveEventDialog) and when editing a team
// name/color inline on the event detail page, so the two stay in sync.
export default function TeamNameColorControls({
  name,
  onNameChange,
  shirtColor,
  onShirtColorToggle,
  onRandomize,
  disabled = false,
  required = false,
  autoFocus = false,
}: TeamNameColorControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-medium"
      />
      {onRandomize && (
        <Tooltip label="Nombre aleatorio">
          <button
            type="button"
            onClick={onRandomize}
            disabled={disabled}
            className="p-2 rounded-lg border border-border hover:bg-border-subtle transition-colors"
          >
            <ShuffleIcon className="w-5 h-5 text-muted" />
          </button>
        </Tooltip>
      )}
      {shirtColor && onShirtColorToggle && (
        <Tooltip label={shirtColor === 'light' ? 'Camiseta clara' : 'Camiseta oscura'}>
          <button
            type="button"
            onClick={onShirtColorToggle}
            disabled={disabled}
            className="p-2 rounded-lg border border-border hover:bg-border-subtle transition-colors"
          >
            <ShirtIcon
              className={`w-5 h-5 ${shirtColor === 'light' ? 'text-shirt-light' : 'text-shirt-dark'}`}
            />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
