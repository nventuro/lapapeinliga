import { useState, useEffect, useMemo } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { useEventsIndex } from '../hooks/useEventsIndex';
import { useSupabaseQuery } from '../hooks/useSupabaseQuery';
import { EQUIPO_TAG_NAME } from '../types';
import type { MediaTag, Player, TaggedPlayer } from '../types';
import type { UploadFileEntry } from '../utils/mediaUpload';
import { supabase } from '../lib/supabase';
import { toLocalISODate } from '../utils/dateUtils';
import DateField from './DateField';
import TagInput from './TagInput';
import EventSelect from './EventSelect';
import ImageCropDialog from './ImageCropDialog';
import PlayerTagInput from './PlayerTagInput';
import { useEventParticipants } from '../hooks/useEventParticipants';
import { useAppContext } from '../context/appContext';

interface MediaUploadDialogProps {
  onClose: () => void;
  onItemUploaded: () => void;
  prefilledEventId?: number | null;
  /** Files uploaded from a trophy's page belong to it as well as to any fecha. */
  trophyId?: number | null;
  /**
   * Who to offer for tagging, when the caller already knows. A trophy carries
   * its own list of who was part of it, and there is no fecha to derive one
   * from -- without this the picker falls back to the entire club.
   */
  tagCandidates?: Player[];
}

function todayISO(): string {
  return toLocalISODate(new Date());
}

export default function MediaUploadDialog({ onClose, onItemUploaded, prefilledEventId, trophyId = null, tagCandidates }: MediaUploadDialogProps) {
  // Step 1: batch metadata
  const [date, setDate] = useState(todayISO);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    prefilledEventId ? String(prefilledEventId) : '',
  );
  const [files, setFiles] = useState<UploadFileEntry[]>([]);

  // Flow control
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Events for dropdown (shown newest-first)
  const { events: eventsAsc, labels: eventLabels } = useEventsIndex();
  const events = useMemo(() => [...eventsAsc].reverse(), [eventsAsc]);

  // All tags for autocomplete
  const { data: allTagsData, refetch: refetchTags } = useSupabaseQuery(async () => {
    const { data, error } = await supabase.from('media_tags').select('*').order('name');
    if (error) throw new Error(error.message);
    return data as MediaTag[];
  }, []);
  const allTags = allTagsData ?? [];

  const { players: allPlayers } = useAppContext();
  const eventId = selectedEventId ? Number(selectedEventId) : null;
  const { participants: eventParticipants, loading: eventParticipantsLoading } = useEventParticipants(
    eventId,
    events.find((e) => e.id === eventId)?.type ?? null,
  );
  const participants = tagCandidates ?? eventParticipants;
  const participantsLoading = tagCandidates ? false : eventParticipantsLoading;

  /**
   * Whether `participants` is an actual roster -- a fecha's or a trophy's --
   * rather than the whole club, which is what useEventParticipants falls back
   * to. Only then does auto-tagging on "equipo" mean anything.
   */
  const hasKnownRoster = tagCandidates != null || eventId !== null;
  const queue = useUploadQueue({ eventId, trophyId, date, onItemUploaded });

  function handleClose() {
    if (!queue.isIdle) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  }

  // Every close attempt goes through handleClose (confirm-if-uploading),
  // including Escape and backdrop clicks.
  const { dialogRef, backdropClick } = useModalDialog(handleClose);

  // Default the date to the prefilled event's date once the index loads
  // (render-time adjust; runs once when the event row appears).
  const prefilledEvent = prefilledEventId ? eventsAsc.find((e) => e.id === prefilledEventId) : undefined;
  const [prefilledDateApplied, setPrefilledDateApplied] = useState(false);
  if (!prefilledDateApplied && prefilledEvent) {
    setPrefilledDateApplied(true);
    setDate(prefilledEvent.played_at);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;

    const entries: UploadFileEntry[] = Array.from(selected).map((file) => ({
      id: crypto.randomUUID(),
      file,
      caption: '',
      tags: [],
      taggedPlayers: [],
    }));
    setFiles((prev) => [...prev, ...entries]);
  }

  function updateCaption(caption: string) {
    setFiles((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], caption };
      return next;
    });
  }

  function handleCropResult(blob: Blob) {
    const index = croppingIndex!;
    const croppedFile = new File([blob], files[index].file.name, { type: 'image/jpeg' });
    setFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], file: croppedFile };
      return next;
    });
    setCroppingIndex(null);
  }

  function updateTags(tags: MediaTag[]) {
    setFiles((prev) => {
      const next = [...prev];
      const oldEntry = prev[currentIndex];
      const hadEquipo = oldEntry.tags.some((t) => t.name === EQUIPO_TAG_NAME);
      const hasEquipo = tags.some((t) => t.name === EQUIPO_TAG_NAME);

      let { taggedPlayers } = oldEntry;

      // Auto-tag everyone on the roster when the "equipo" tag is added
      if (!hadEquipo && hasEquipo && hasKnownRoster && participants.length > 0) {
        const currentIds = new Set(taggedPlayers.map((p) => p.id));
        const newPlayers: TaggedPlayer[] = participants
          .filter((p) => !currentIds.has(p.id))
          .map(({ id, name }) => ({ id, name }));
        taggedPlayers = [...taggedPlayers, ...newPlayers];
      }

      next[currentIndex] = { ...oldEntry, tags, taggedPlayers };
      return next;
    });
  }

  function updateTaggedPlayers(taggedPlayers: TaggedPlayer[]) {
    setFiles((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], taggedPlayers };
      return next;
    });
  }

  async function handleCreateTag(name: string): Promise<MediaTag | null> {
    // Reuse an existing tag with the same name (case-insensitive) so 'Asado'
    // and 'asado' can't fork; the DB has a matching unique index.
    const { data: existing } = await supabase
      .from('media_tags')
      .select('id, name')
      .ilike('name', name)
      .maybeSingle();
    if (existing) return existing as MediaTag;

    const { data, error } = await supabase
      .from('media_tags')
      .insert({ name })
      .select()
      .single();
    if (error || !data) return null;
    refetchTags();
    return data as MediaTag;
  }

  // Find the index of the next pending file after currentIndex
  function findNextPending(afterIndex: number): number | null {
    for (let i = afterIndex + 1; i < files.length; i++) {
      if (!queue.statuses.has(files[i].id)) return i;
    }
    return null;
  }

  function handleNext() {
    const entry = files[currentIndex];
    queue.enqueue(entry);

    const next = findNextPending(currentIndex);
    if (next !== null) {
      setCurrentIndex(next);
    } else {
      setStep(3);
    }
  }

  function handleSkip() {
    const skippedId = files[currentIndex].id;
    const next = files.filter((f) => f.id !== skippedId);
    setFiles(next);

    const remaining = next.filter((f) => !queue.statuses.has(f.id));
    if (remaining.length === 0) {
      // Nothing left to edit. If anything was enqueued — including uploads
      // that already failed — show the summary; closing here would hide the
      // errors and the retry button.
      if (queue.statuses.size > 0) {
        setStep(3);
      } else {
        onClose();
      }
      return;
    }

    // Move to the first still-pending file. Under the sequential flow that is
    // the file that slid into currentIndex, but compute it instead of assuming
    // it — a stale index past the end would render a blank editor.
    setCurrentIndex(next.findIndex((f) => !queue.statuses.has(f.id)));
  }

  function confirmClose() {
    queue.abort();
    onClose();
  }

  const currentFile = files[currentIndex];

  // Lazily create a single blob URL for the current file only, revoked
  // automatically when the file changes or the component unmounts.
  const currentFileObj = currentFile?.file ?? null;
  const previewUrl = useMemo(() => {
    if (!currentFileObj) return '';
    return URL.createObjectURL(currentFileObj);
  }, [currentFileObj]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Track preview load state so we surface errors instead of showing a blank
  // area; resets whenever the previewed file changes (render-time adjust).
  const [previewState, setPreviewState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [lastPreviewUrl, setLastPreviewUrl] = useState(previewUrl);
  if (lastPreviewUrl !== previewUrl) {
    setLastPreviewUrl(previewUrl);
    setPreviewState('loading');
  }

  const isLastPending = currentFile ? findNextPending(currentIndex) === null : true;

  // Count how many files are still pending edit (not yet enqueued)
  const pendingEditCount = files.filter((f) => !queue.statuses.has(f.id)).length;

  // Build status line for step 2 header
  function buildStatusLine(): string {
    const parts: string[] = [];
    if (queue.doneCount > 0) parts.push(`${queue.doneCount} subida${queue.doneCount !== 1 ? 's' : ''}`);
    if (queue.activeCount > 0) parts.push(`${queue.activeCount} subiendo`);
    if (queue.failedCount > 0) parts.push(`${queue.failedCount} con error`);
    return parts.join(', ');
  }

  return (
    <>
    <dialog
      ref={dialogRef}
      className="fixed m-auto w-full max-w-lg max-h-[100dvh] rounded-xl border border-border bg-surface shadow-xl backdrop:bg-on-surface/50 flex flex-col overflow-hidden"
      onClick={backdropClick}
    >
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">
            {step === 2 && currentFile
              ? `Subir fotos (${files.indexOf(currentFile) + 1}/${files.length})`
              : step === 3
                ? (queue.isIdle
                  ? (queue.failedCount > 0 ? 'Subida con errores' : 'Listo')
                  : 'Subiendo...')
                : 'Subir fotos'}
          </h3>
          <button onClick={handleClose} className="text-muted hover:text-muted-strong text-xl leading-none transition-colors">&times;</button>
        </div>
        {step === 2 && buildStatusLine() && (
          <p className="text-xs text-muted mt-1">{buildStatusLine()}</p>
        )}
      </div>

      {/* ── Step 1: Batch metadata ── */}
      {step === 1 && (
        <div className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Archivos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="w-full text-sm text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-border file:bg-border-subtle file:text-on-surface file:text-sm file:font-medium file:cursor-pointer"
            />
            {files.length > 0 && (
              <p className="text-xs text-muted mt-1">{files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Uploading from a trophy: the photos belong to it, not to a fecha,
              so there is nothing to pick. */}
          {trophyId === null && (
          <div>
            <label className="block text-sm font-medium mb-1">Evento</label>
            <EventSelect
              events={events}
              eventLabels={eventLabels}
              value={selectedEventId}
              onChange={(val) => {
                setSelectedEventId(val);
                if (val) {
                  const event = events.find((ev) => String(ev.id) === val);
                  if (event) setDate(event.played_at);
                }
              }}
              emptyLabel="Sin evento asociado"
            />
          </div>
          )}

          {!selectedEventId && (
            <div>
              <label className="block text-sm font-medium mb-1">Fecha</label>
              <DateField value={date} onChange={setDate} />
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={files.length === 0}
            className="w-full py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* ── Step 2: One-at-a-time editor ── */}
      {step === 2 && currentFile && (
        <div className="flex-1 min-h-0 flex flex-col gap-3 px-6 pb-6">
          {/* Preview (shrinks to fit viewport) — uses absolute positioning
              so image size doesn't depend on percentage height resolution,
              which some browsers fail at inside flex-grown containers. */}
          <div
            className={`min-h-24 flex-1 relative rounded-lg overflow-hidden bg-border-subtle flex items-center justify-center ${previewState === 'loaded' ? 'cursor-pointer' : ''}`}
            onClick={() => { if (previewState === 'loaded') setCroppingIndex(currentIndex); }}
          >
            {previewState === 'error' ? (
              <p className="text-error text-sm px-4 text-center">
                No se pudo cargar la vista previa. Probá saltando este archivo.
              </p>
            ) : (
              <>
                <img
                  key={currentFile.id}
                  src={previewUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                  onLoad={() => setPreviewState('loaded')}
                  onError={() => setPreviewState('error')}
                />
                {previewState === 'loading' && (
                  <span className="text-muted text-sm">Cargando...</span>
                )}
                {previewState === 'loaded' && (
                  <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-on-surface/60 text-surface px-2 py-0.5 rounded-full pointer-events-none">
                    Tocá para recortar
                  </span>
                )}
              </>
            )}
          </div>

          {/* Controls (fixed size, never shrink) */}
          <div className="shrink-0 space-y-3">
            {/* Caption */}
            <input
              type="text"
              value={currentFile.caption}
              onChange={(e) => updateCaption(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface text-on-surface placeholder:text-muted"
            />

            {/* Tags */}
            <TagInput
              allTags={allTags}
              selectedTags={currentFile.tags}
              onChange={(tags) => updateTags(tags)}
              onCreateTag={handleCreateTag}
            />

            {/* Player tags */}
            <PlayerTagInput
              candidates={participants}
              allPlayers={allPlayers}
              selected={currentFile.taggedPlayers}
              onChange={updateTaggedPlayers}
              loading={participantsLoading}
            />

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
              >
                Saltar
              </button>
              <button
                onClick={handleNext}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
              >
                {isLastPending ? 'Subir' : 'Siguiente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Summary / waiting ── */}
      {step === 3 && (
        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-2 text-sm">
            {queue.doneCount > 0 && (
              <p className="text-on-surface">
                <span className="text-accent">✓</span> {queue.doneCount} subida{queue.doneCount !== 1 ? 's' : ''}
              </p>
            )}
            {queue.activeCount > 0 && (
              <p className="text-muted animate-pulse">
                ⟳ {queue.activeCount} subiendo...
              </p>
            )}
            {queue.failedCount > 0 && (
              <p className="text-error">
                ✗ {queue.failedCount} con error
              </p>
            )}
            {pendingEditCount > 0 && (
              <p className="text-muted">
                {pendingEditCount} pendiente{pendingEditCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {!queue.isIdle && (
            <div className="w-full bg-border-subtle rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all animate-pulse"
                style={{ width: `${queue.doneCount + queue.failedCount > 0 ? ((queue.doneCount / (queue.doneCount + queue.activeCount + queue.failedCount)) * 100) : 0}%` }}
              />
            </div>
          )}

          <div className="flex gap-3">
            {queue.failedCount > 0 && (
              <button
                onClick={queue.retryFailed}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
              >
                Reintentar
              </button>
            )}
            <button
              onClick={onClose}
              disabled={!queue.isIdle}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Close confirmation overlay */}
      {showCloseConfirm && (
        <div className="absolute inset-0 bg-surface/95 rounded-xl flex flex-col items-center justify-center p-6 space-y-4">
          <p className="text-sm text-center">
            Hay archivos subiendo. Si cerrás, las subidas en curso se van a cancelar.
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => setShowCloseConfirm(false)}
              className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-error text-on-primary hover:opacity-90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </dialog>

    {croppingIndex !== null && files[croppingIndex] && (
      <ImageCropDialog
        src={previewUrl}
        onClose={() => setCroppingIndex(null)}
        onCrop={(blob) => handleCropResult(blob)}
        onSkip={() => setCroppingIndex(null)}
      />
    )}
  </>
  );
}
