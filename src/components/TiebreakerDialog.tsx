import { useEffect, useRef, useState } from 'react';
import type { AwardType, Player } from '../types';
import { AWARD_LABELS } from '../types';
import { AWARD_ICONS } from './awardIcons';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface TiebreakerDialogProps {
  award: AwardType;
  tiedCandidates: Player[];
  onResolve: (playerId: number) => Promise<void>;
  onClose: () => void;
}

export default function TiebreakerDialog({ award, tiedCandidates, onResolve, onClose }: TiebreakerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useBodyScrollLock();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  async function handlePick(playerId: number) {
    setSaving(true);
    setError(null);
    try {
      await onResolve(playerId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al resolver el empate');
      setSaving(false);
    }
  }

  const Icon = AWARD_ICONS[award];
  const sorted = [...tiedCandidates].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-full max-w-md backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="p-6" tabIndex={-1}>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-1">
          <Icon className="w-5 h-5 text-gold" />
          Resolver empate
        </h2>
        <p className="text-sm text-muted mb-4">
          {AWARD_LABELS[award]} — elegí al ganador entre los jugadores empatados.
        </p>

        <div className="space-y-2">
          {sorted.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => handlePick(player.id)}
              disabled={saving}
              className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface hover:border-gold hover:bg-border-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {player.name}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-error mt-3">{error}</p>}

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-full py-2 rounded-lg font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </dialog>
  );
}
