import { useMemo, useState } from 'react';
import type { TaggedPlayer, TrophyWithDetails } from '../types';
import { MAX_TROPHY_TITLE_LENGTH } from '../types';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../context/appContext';
import { useModalDialog } from '../hooks/useModalDialog';
import { useEventParticipants } from '../hooks/useEventParticipants';
import { useEventsIndex } from '../hooks/useEventsIndex';
import { toLocalISODate } from '../utils/dateUtils';
import DateField from './DateField';
import EventSelect from './EventSelect';
import PlayerTagInput from './PlayerTagInput';

interface TrophyFormDialogProps {
  /** Absent when creating. */
  trophy?: TrophyWithDetails;
  onClose: () => void;
  onSaved: () => void;
}

export default function TrophyFormDialog({ trophy, onClose, onSaved }: TrophyFormDialogProps) {
  const { players: allPlayers } = useAppContext();
  const { dialogRef, backdropClick } = useModalDialog(onClose);

  const [title, setTitle] = useState(trophy?.title ?? '');
  const [wonAt, setWonAt] = useState(trophy?.won_at ?? toLocalISODate(new Date()));
  const [eventId, setEventId] = useState(trophy?.event_id ? String(trophy.event_id) : '');
  const [participants, setParticipants] = useState<TaggedPlayer[]>(
    () => (trophy?.participants ?? []).map((p) => ({ id: p.id, name: p.name })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { events: eventsAsc, labels: eventLabels } = useEventsIndex();
  const events = useMemo(() => [...eventsAsc].reverse(), [eventsAsc]);

  const linkedEventId = eventId ? Number(eventId) : null;
  // The linked fecha's roster is offered first, but only as a shortcut: a final
  // is rarely played by everyone who turned up, so the real list is whatever
  // gets picked here.
  const { participants: candidates, loading: candidatesLoading } = useEventParticipants(
    linkedEventId,
    events.find((e) => e.id === linkedEventId)?.type ?? null,
  );

  /** Picking a fecha pre-fills its date, the way the upload dialog does. */
  function handleEventChange(value: string) {
    setEventId(value);
    const picked = value ? eventsAsc.find((e) => e.id === Number(value)) : undefined;
    if (picked) setWonAt(picked.played_at);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setSaving(true);
    setError(null);

    const fields = {
      title: trimmedTitle,
      won_at: wonAt,
      event_id: linkedEventId,
    };

    let trophyId = trophy?.id;
    if (trophyId === undefined) {
      const { data, error: insertError } = await supabase
        .from('trophies')
        .insert(fields)
        .select('id')
        .single();
      if (insertError || !data) {
        setSaving(false);
        setError(insertError?.message ?? 'No se pudo guardar el trofeo.');
        return;
      }
      trophyId = data.id as number;
    } else {
      const { error: updateError } = await supabase
        .from('trophies')
        .update(fields)
        .eq('id', trophyId);
      if (updateError) {
        setSaving(false);
        setError(updateError.message);
        return;
      }
    }

    // Sync the roster as a diff rather than delete-all-then-reinsert, so a
    // failure halfway cannot leave the trophy with nobody on it.
    const before = new Set((trophy?.participants ?? []).map((p) => p.id));
    const after = new Set(participants.map((p) => p.id));
    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));

    if (added.length > 0) {
      const { error: addError } = await supabase
        .from('trophy_participants')
        .insert(added.map((playerId) => ({ trophy_id: trophyId, player_id: playerId })));
      if (addError) {
        setSaving(false);
        setError(addError.message);
        return;
      }
    }
    if (removed.length > 0) {
      const { error: removeError } = await supabase
        .from('trophy_participants')
        .delete()
        .eq('trophy_id', trophyId)
        .in('player_id', removed);
      if (removeError) {
        setSaving(false);
        setError(removeError.message);
        return;
      }
    }

    onSaved();
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed m-auto bg-surface text-on-surface rounded-xl shadow-xl p-0 w-full max-w-sm max-h-[90dvh] flex flex-col overflow-hidden backdrop:bg-on-surface/50"
      onClick={backdropClick}
    >
      {/* With no fecha linked every player is a candidate, so the body scrolls
          and the actions stay pinned -- otherwise a fifty-name roster pushes
          "Guardar" off the bottom of the screen. */}
      <form onSubmit={handleSave} className="flex flex-col min-h-0">
        <div className="p-6 pb-4 space-y-4 overflow-y-auto" tabIndex={-1}>
          <h2 className="text-lg font-bold">{trophy ? 'Editar trofeo' : 'Nuevo trofeo'}</h2>

          <div className="space-y-1.5">
            <label className="text-xs text-muted" htmlFor="trophy-title">Título</label>
            <input
              id="trophy-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Copa Papeinliga 2026"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted"
              autoFocus
              maxLength={MAX_TROPHY_TITLE_LENGTH}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-muted">Cuándo</span>
            <DateField value={wonAt} onChange={setWonAt} disabled={saving} />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs text-muted">Fecha relacionada</span>
            <EventSelect
              events={events}
              eventLabels={eventLabels}
              value={eventId}
              onChange={handleEventChange}
              emptyLabel="Sin fecha relacionada"
            />
          </div>

          <PlayerTagInput
            candidates={candidates}
            allPlayers={allPlayers}
            selected={participants}
            onChange={setParticipants}
            loading={candidatesLoading}
          />

          {error && <p className="text-xs text-error">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end border-t border-border-subtle px-6 py-4 bg-surface">
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
            disabled={saving || !title.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-on-primary font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
