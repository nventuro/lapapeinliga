import { useState } from 'react';
import { EVENT_FEEDBACK_MAX_LENGTH } from '../types';

interface FeedbackInputProps {
  savedBody: string | null;
  loading: boolean;
  onSubmit: (body: string) => Promise<void>;
  onClear: () => Promise<void>;
}

export default function FeedbackInput({ savedBody, loading, onSubmit, onClear }: FeedbackInputProps) {
  const [draft, setDraft] = useState(savedBody ?? '');
  const [lastSeenSavedBody, setLastSeenSavedBody] = useState(savedBody);
  const [saving, setSaving] = useState(false);

  // Resync draft when savedBody changes externally (initial fetch, after save).
  if (savedBody !== lastSeenSavedBody) {
    setLastSeenSavedBody(savedBody);
    setDraft(savedBody ?? '');
  }

  const trimmed = draft.trim();
  const tooLong = trimmed.length > EVENT_FEEDBACK_MAX_LENGTH;
  const hasChanges = trimmed !== (savedBody ?? '');
  const canSave = hasChanges && trimmed.length > 0 && !tooLong && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit(trimmed);
    } catch {
      // error surfaces via the hook; swallow so the button re-enables
    }
    setSaving(false);
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onClear();
    } catch {
      // error surfaces via the hook
    }
    setSaving(false);
  }

  return (
    <div>
      <h4 className="text-sm font-medium">Comentarios</h4>
      <p className="text-xs text-muted mb-1">
        Anónimos. Sólo los admins los ven, una vez cerrada la votación.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={loading || saving}
        rows={4}
        placeholder="¿Algo para compartir sobre el partido? (opcional)"
        className={`w-full px-3 py-2 rounded-lg border bg-surface text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${tooLong ? 'border-error' : 'border-border'}`}
      />
      <div className="flex items-center justify-between mt-1">
        <span className={`text-xs ${tooLong ? 'text-error' : 'text-muted'}`}>
          {trimmed.length} / {EVENT_FEEDBACK_MAX_LENGTH}
        </span>
        <div className="flex items-center gap-3">
          {savedBody != null && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="text-xs text-muted hover:text-error underline underline-offset-2"
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Guardar
          </button>
        </div>
      </div>
      {savedBody != null && !hasChanges && (
        <p className="text-xs text-muted italic mt-1">
          Tu comentario fue guardado. Podés cambiarlo hasta que cierre la votación.
        </p>
      )}
    </div>
  );
}
