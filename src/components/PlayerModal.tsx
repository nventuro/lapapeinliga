import { useState, useRef, useEffect } from 'react';
import type { Player, PlayerPreference, PreferenceType } from '../types';
import { MIN_RATING, MAX_RATING } from '../types';
import { supabase } from '../lib/supabase';
import { capitalizeName } from '../utils/nameUtils';
import { useAppContext } from '../context/appContext';

const PREFERENCE_LABELS: Record<PreferenceType, string> = {
  prefer_with: 'Prefiere con',
  strongly_prefer_with: 'Debe estar con',
  prefer_not_with: 'Prefiere no estar con',
};

const PREFERENCE_OPTIONS: { value: PreferenceType; label: string }[] = [
  { value: 'prefer_with', label: 'Prefiere con' },
  { value: 'strongly_prefer_with', label: 'Debe estar con' },
  { value: 'prefer_not_with', label: 'Prefiere no estar con' },
];

interface PlayerModalProps {
  player: Player | null; // null = creating new player
  onClose: () => void;
}

interface PendingPreference {
  playerId: number;
  type: PreferenceType;
}

export default function PlayerModal({ player, onClose }: PlayerModalProps) {
  const { players, preferences, refetchData } = useAppContext();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [name, setName] = useState(player?.name ?? '');
  const [gender, setGender] = useState<'male' | 'female'>(player?.gender ?? 'male');
  const [rating, setRating] = useState(player?.rating ?? 5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Batched preference changes (edit mode only)
  const existingPrefs = player
    ? preferences.filter(
        (p) => p.player_a_id === player.id || p.player_b_id === player.id,
      )
    : [];

  const [deletedPrefKeys, setDeletedPrefKeys] = useState<Set<string>>(() => new Set());
  const [addedPrefs, setAddedPrefs] = useState<PendingPreference[]>([]);

  // Preference add form state
  const [newPrefPlayerId, setNewPrefPlayerId] = useState<number | ''>('');
  const [newPrefType, setNewPrefType] = useState<PreferenceType>('prefer_with');

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

  function prefKey(pref: PlayerPreference): string {
    return `${pref.player_a_id}-${pref.player_b_id}`;
  }

  // Visible preferences = existing (minus deleted) + added
  const visibleExisting = existingPrefs.filter((p) => !deletedPrefKeys.has(prefKey(p)));

  // All paired player IDs (existing not deleted + added)
  const pairedIds = new Set([
    ...visibleExisting.map((p) =>
      p.player_a_id === player?.id ? p.player_b_id : p.player_a_id,
    ),
    ...addedPrefs.map((p) => p.playerId),
  ]);
  const availablePlayers = players.filter(
    (p) => p.id !== player?.id && !pairedIds.has(p.id),
  );

  function getOtherPlayerName(pref: PlayerPreference): string {
    const otherId =
      pref.player_a_id === player!.id ? pref.player_b_id : pref.player_a_id;
    return players.find((p) => p.id === otherId)?.name ?? 'Desconocido';
  }

  function handleAddPreference() {
    if (newPrefPlayerId === '') return;
    setAddedPrefs((prev) => [...prev, { playerId: newPrefPlayerId, type: newPrefType }]);
    setNewPrefPlayerId('');
    setNewPrefType('prefer_with');
  }

  function handleDeleteExistingPref(pref: PlayerPreference) {
    setDeletedPrefKeys((prev) => new Set(prev).add(prefKey(pref)));
  }

  function handleDeleteAddedPref(index: number) {
    setAddedPrefs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const trimmed = capitalizeName(name);
    if (!trimmed) {
      setError('El nombre no puede estar vacío.');
      setSaving(false);
      return;
    }

    // Client-side duplicate check
    const duplicate = players.find(
      (p) =>
        p.id !== player?.id &&
        p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setError(`Ya existe un jugador con el nombre "${duplicate.name}".`);
      setSaving(false);
      return;
    }

    if (player) {
      // Update player
      const { error: dbError } = await supabase
        .from('players')
        .update({ name: trimmed, gender, rating })
        .eq('id', player.id);

      if (dbError) {
        if (dbError.code === '23505') {
          setError(`Ya existe un jugador con el nombre "${trimmed}".`);
        } else {
          setError(dbError.message);
        }
        setSaving(false);
        return;
      }

      // Apply batched preference deletions
      for (const key of deletedPrefKeys) {
        const [aId, bId] = key.split('-').map(Number);
        const { error: delError } = await supabase
          .from('player_preferences')
          .delete()
          .eq('player_a_id', aId)
          .eq('player_b_id', bId);

        if (delError) {
          setError(delError.message);
          setSaving(false);
          return;
        }
      }

      // Apply batched preference additions
      for (const added of addedPrefs) {
        const [aId, bId] =
          player.id < added.playerId
            ? [player.id, added.playerId]
            : [added.playerId, player.id];

        const { error: addError } = await supabase
          .from('player_preferences')
          .insert({
            player_a_id: aId,
            player_b_id: bId,
            preference: added.type,
          });

        if (addError) {
          setError(addError.message);
          setSaving(false);
          return;
        }
      }
    } else {
      // Create player
      const { error: dbError } = await supabase
        .from('players')
        .insert({ name: trimmed, gender, rating });

      if (dbError) {
        if (dbError.code === '23505') {
          setError(`Ya existe un jugador con el nombre "${trimmed}".`);
        } else {
          setError(dbError.message);
        }
        setSaving(false);
        return;
      }
    }

    await refetchData();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-full max-w-md backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <form onSubmit={handleSave} className="p-6">
        <h2 className="text-xl font-bold mb-4">
          {player ? 'Editar jugador' : 'Nuevo jugador'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Género</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as 'male' | 'female')}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Rating ({MIN_RATING}–{MAX_RATING})
            </label>
            <input
              type="number"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              min={MIN_RATING}
              max={MAX_RATING}
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-error mt-3">{error}</p>
        )}

        {/* Preferences section — edit mode only */}
        {player && (
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-sm font-bold mb-3">Preferencias</h3>

            {visibleExisting.length === 0 && addedPrefs.length === 0 && (
              <p className="text-sm text-muted mb-3">Sin preferencias.</p>
            )}

            {(visibleExisting.length > 0 || addedPrefs.length > 0) && (
              <ul className="space-y-2 mb-3">
                {visibleExisting.map((pref) => (
                  <li
                    key={prefKey(pref)}
                    className="flex items-center justify-between text-sm bg-border-subtle rounded-lg px-3 py-2"
                  >
                    <span>
                      <span className="text-muted">{PREFERENCE_LABELS[pref.preference]}</span>{' '}
                      <span className="font-medium">{getOtherPlayerName(pref)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingPref(pref)}
                      className="text-error hover:text-error/80 font-bold ml-2"
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {addedPrefs.map((pref, index) => (
                  <li
                    key={`added-${index}`}
                    className="flex items-center justify-between text-sm bg-border-subtle rounded-lg px-3 py-2"
                  >
                    <span>
                      <span className="text-muted">{PREFERENCE_LABELS[pref.type]}</span>{' '}
                      <span className="font-medium">
                        {players.find((p) => p.id === pref.playerId)?.name ?? 'Desconocido'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddedPref(index)}
                      className="text-error hover:text-error/80 font-bold ml-2"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {availablePlayers.length > 0 && (
              <div className="flex gap-2 items-end">
                <select
                  value={newPrefType}
                  onChange={(e) =>
                    setNewPrefType(e.target.value as PreferenceType)
                  }
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PREFERENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  value={newPrefPlayerId}
                  onChange={(e) =>
                    setNewPrefPlayerId(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-surface text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Jugador...</option>
                  {availablePlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddPreference}
                  disabled={newPrefPlayerId === ''}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
                >
                  Agregar
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-lg font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2 rounded-lg font-bold text-on-primary bg-primary hover:bg-primary-hover disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
