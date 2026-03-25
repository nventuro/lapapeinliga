import { useState, useRef, useEffect } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useUploadQueue } from '../hooks/useUploadQueue';
import { EQUIPO_TAG_NAME } from '../types';
import type { Event as AppEvent, MediaTag, TaggedPlayer } from '../types';
import type { UploadFileEntry } from '../utils/mediaUpload';
import { supabase } from '../lib/supabase';
import { orderEvents, buildEventLabels } from '../lib/supabase';
import { formatDateShort } from '../utils/dateUtils';
import TagInput from './TagInput';
import VideoTrimEditor from './VideoTrimEditor';
import EventSelect from './EventSelect';
import ImageCropDialog from './ImageCropDialog';
import PlayerTagInput from './PlayerTagInput';
import { useEventParticipants } from '../hooks/useEventParticipants';

interface MediaUploadDialogProps {
  onClose: () => void;
  onItemUploaded: () => void;
  prefilledEventId?: number | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MediaUploadDialog({ onClose, onItemUploaded, prefilledEventId }: MediaUploadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useBodyScrollLock();

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

  // Events for dropdown
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [eventLabels, setEventLabels] = useState<Map<number, string>>(new Map());

  // All tags for autocomplete
  const [allTags, setAllTags] = useState<MediaTag[]>([]);

  const eventId = selectedEventId ? Number(selectedEventId) : null;
  const { participants, loading: participantsLoading } = useEventParticipants(eventId);
  const queue = useUploadQueue({ eventId, date, onItemUploaded });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    const handleCancel = (e: Event) => {
      e.preventDefault();
      handleClose();
    };
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [eventsResult, tagsResult] = await Promise.all([
        orderEvents(supabase.from('events').select('*'), true),
        supabase.from('media_tags').select('*').order('name'),
      ]);
      if (eventsResult.data) {
        const evts = eventsResult.data as AppEvent[];
        setEventLabels(buildEventLabels(evts));
        setEvents([...evts].reverse());
        if (prefilledEventId) {
          const prefilled = evts.find((e) => e.id === prefilledEventId);
          if (prefilled) setDate(prefilled.played_at);
        }
      }
      if (tagsResult.data) setAllTags(tagsResult.data as MediaTag[]);
    }
    fetchData();
  }, [prefilledEventId]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;

    const entries: UploadFileEntry[] = Array.from(selected).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      caption: '',
      tags: [],
      taggedPlayers: [],
      isVideo: file.type.startsWith('video/'),
      processedBlob: null,
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
    const newPreview = URL.createObjectURL(blob);
    const croppedFile = new File([blob], files[index].file.name, { type: 'image/jpeg' });
    setFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next[index] = { ...next[index], file: croppedFile, preview: newPreview };
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

      // Auto-tag all event participants when "equipo" tag is added
      if (!hadEquipo && hasEquipo && eventId !== null && participants.length > 0) {
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

  function setProcessedBlob(blob: Blob) {
    setFiles((prev) => {
      const next = [...prev];
      next[currentIndex] = { ...next[currentIndex], processedBlob: blob };
      return next;
    });
  }

  async function handleCreateTag(name: string): Promise<MediaTag | null> {
    const { data, error } = await supabase
      .from('media_tags')
      .insert({ name })
      .select()
      .single();
    if (error || !data) return null;
    const tag = data as MediaTag;
    setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    return tag;
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
    // Remove this file from the list
    const skippedId = files[currentIndex].id;
    setFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[currentIndex].preview);
      next.splice(currentIndex, 1);
      return next;
    });

    // Find next file to edit. After splice, currentIndex might point to the next file already.
    // But we need to recalculate since the array shifted.
    const remaining = files.filter((f) => f.id !== skippedId && !queue.statuses.has(f.id));
    if (remaining.length === 0) {
      // No more files to edit
      if (queue.doneCount > 0 || queue.activeCount > 0) {
        setStep(3);
      } else {
        // Nothing uploaded and nothing left — just close
        onClose();
      }
    }
    // If there are remaining files, currentIndex now points to the next one
    // (or needs adjustment if we were at the end)
  }

  function handleClose() {
    if (!queue.isIdle) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  }

  function confirmClose() {
    queue.abort();
    onClose();
  }

  const currentFile = files[currentIndex];
  const isLastPending = currentFile ? findNextPending(currentIndex) === null : true;
  const canSubmitCurrent = currentFile && (!currentFile.isVideo || currentFile.processedBlob);

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
              accept="image/*,video/mp4,video/quicktime"
              multiple
              onChange={handleFileSelect}
              className="w-full text-sm text-muted file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-border file:bg-border-subtle file:text-on-surface file:text-sm file:font-medium file:cursor-pointer"
            />
            {files.length > 0 && (
              <p className="text-xs text-muted mt-1">{files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Evento (opcional)</label>
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

          {!selectedEventId && (
            <div>
              <label className="block text-sm font-medium mb-1">Fecha</label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary opacity-0 absolute inset-0 z-20 cursor-pointer"
                />
                <div className="px-3 py-2 rounded-lg border border-border bg-surface text-on-surface cursor-pointer">
                  {formatDateShort(date)}
                </div>
              </div>
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
          {/* Preview (shrinks to fit viewport) */}
          <div
            className={`min-h-24 flex-1 relative rounded-lg overflow-hidden bg-border-subtle flex items-center justify-center ${!currentFile.isVideo ? 'cursor-pointer' : ''}`}
            onClick={() => { if (!currentFile.isVideo) setCroppingIndex(currentIndex); }}
          >
            {currentFile.isVideo ? (
              <video
                src={currentFile.preview}
                className="max-w-full max-h-full object-contain"
                muted
              />
            ) : (
              <>
                <img
                  src={currentFile.preview}
                  alt=""
                  className="max-w-full max-h-full object-contain"
                />
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs bg-on-surface/60 text-surface px-2 py-0.5 rounded-full pointer-events-none">
                  Tocá para recortar
                </span>
              </>
            )}
          </div>

          {/* Controls (fixed size, never shrink) */}
          <div className="shrink-0 space-y-3">
            {/* Video trim editor */}
            {currentFile.isVideo && !currentFile.processedBlob && (
              <VideoTrimEditor
                file={currentFile.file}
                onConfirm={(blob) => setProcessedBlob(blob)}
              />
            )}
            {currentFile.isVideo && currentFile.processedBlob && (
              <p className="text-xs text-primary">Boomerang listo</p>
            )}

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
                disabled={!canSubmitCurrent}
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
                <span className="text-primary">✓</span> {queue.doneCount} subida{queue.doneCount !== 1 ? 's' : ''}
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

    {croppingIndex !== null && files[croppingIndex] && !files[croppingIndex].isVideo && (
      <ImageCropDialog
        src={files[croppingIndex].preview}
        onClose={() => setCroppingIndex(null)}
        onCrop={(blob) => handleCropResult(blob)}
        onSkip={() => setCroppingIndex(null)}
      />
    )}
  </>
  );
}
