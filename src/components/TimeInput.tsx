import { useState } from 'react';

interface TimeInputProps {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Two-field 24h time input (HH : MM) that works well on mobile numeric keyboards. */
export default function TimeInput({ value, onChange, disabled }: TimeInputProps) {
  const [hours, minutes] = value ? value.split(':') : ['', ''];
  const [localHours, setLocalHours] = useState<string | null>(null);
  const [localMinutes, setLocalMinutes] = useState<string | null>(null);

  function commit(h: string, m: string) {
    if (h === '' && m === '') {
      onChange('');
    } else {
      onChange(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        placeholder="HH"
        value={localHours ?? hours}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          setLocalHours(digits);
        }}
        onBlur={() => {
          const h = localHours ?? hours;
          setLocalHours(null);
          commit(h, minutes);
        }}
        disabled={disabled}
        className="w-16 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <span className="text-lg font-bold text-muted">:</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="MM"
        value={localMinutes ?? minutes}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          setLocalMinutes(digits);
        }}
        onBlur={() => {
          const m = localMinutes ?? minutes;
          setLocalMinutes(null);
          commit(hours, m);
        }}
        disabled={disabled}
        className="w-16 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
