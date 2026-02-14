import { useState } from 'react';

interface ConfirmActionProps {
  /** Text shown on the initial trigger button. */
  label: string;
  /** Confirmation prompt shown after clicking. */
  message: string;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Optional class name for the outer wrapper. */
  className?: string;
}

export default function ConfirmAction({ label, message, onConfirm, className = '' }: ConfirmActionProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className={`border border-error rounded-lg p-4 ${className}`}>
        <p className="text-sm mb-3">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-error text-on-primary hover:bg-error/80 transition-colors"
          >
            {label}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`w-full py-2 rounded-lg text-sm font-medium text-error border border-error hover:bg-error hover:text-on-primary transition-colors ${className}`}
    >
      {label}
    </button>
  );
}
