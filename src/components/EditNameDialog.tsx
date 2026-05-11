import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { capitalizeName } from '../utils/nameUtils';
import { useAppContext } from '../context/appContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface EditNameDialogProps {
  currentName: string;
  onClose: () => void;
}

export default function EditNameDialog({ currentName, onClose }: EditNameDialogProps) {
  const { refetchData } = useAppContext();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useBodyScrollLock();

  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = capitalizeName(name);
    if (!trimmed) return;
    if (trimmed === currentName) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('update_my_player_name', { new_name: trimmed });
    if (rpcError) {
      setSaving(false);
      if (rpcError.code === '23505') {
        setError('Ya existe un jugador con ese nombre.');
      } else {
        setError(rpcError.message);
      }
      return;
    }
    await refetchData();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-full max-w-xs backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={handleSave}>
        <div className="p-6 space-y-4" tabIndex={-1}>
          <h2 className="text-lg font-bold">Cambiar nombre</h2>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
            maxLength={60}
          />

          {error && <p className="text-xs text-error">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-border-subtle transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-on-primary font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
