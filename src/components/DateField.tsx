import { useRef } from 'react';
import { formatDateShort } from '../utils/dateUtils';

interface DateFieldProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A date field displayed as dd/mm/yyyy that opens the native picker on tap.
 * The real input stays screen-reader-only so the browser can't render its
 * locale-dependent (possibly mm/dd) textual form.
 */
export default function DateField({ value, onChange, disabled = false }: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        disabled={disabled}
        className="sr-only"
      />
      <div
        onClick={() => { if (!disabled) inputRef.current?.showPicker(); }}
        className="px-3 py-2 rounded-lg border border-border bg-surface text-on-surface cursor-pointer"
      >
        {formatDateShort(value)}
      </div>
    </div>
  );
}
