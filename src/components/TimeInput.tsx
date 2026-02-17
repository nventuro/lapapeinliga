interface TimeInputProps {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Two-field 24h time input (HH : MM) that works well on mobile numeric keyboards. */
export default function TimeInput({ value, onChange, disabled }: TimeInputProps) {
  const [hours, minutes] = value ? value.split(':') : ['', ''];

  function update(h: string, m: string) {
    if (h === '' && m === '') {
      onChange('');
    } else {
      onChange(`${h.padStart(2, '0')}:${m.padStart(2, '0')}`);
    }
  }

  function handleHoursChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    update(digits, minutes);
  }

  function handleMinutesChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    update(hours, digits);
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        inputMode="numeric"
        placeholder="HH"
        value={hours}
        onChange={(e) => handleHoursChange(e.target.value)}
        disabled={disabled}
        className="w-16 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <span className="text-lg font-bold text-muted">:</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="MM"
        value={minutes}
        onChange={(e) => handleMinutesChange(e.target.value)}
        disabled={disabled}
        className="w-16 px-3 py-2 rounded-lg border border-border bg-surface text-on-surface text-center focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );
}
