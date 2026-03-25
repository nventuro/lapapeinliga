import { useState, useRef, useEffect } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { Event as AppEvent, MediaTag } from '../types';
import { supabase } from '../lib/supabase';
import { orderEvents, buildEventLabels } from '../lib/supabase';
import { formatDateShort } from '../utils/dateUtils';
import { compressImage } from '../utils/imageCompression';
import { extractFirstFrame, getVideoAspectRatio } from '../utils/videoProcessing';
import { getUploadUrls, uploadToR2 } from '../utils/mediaUpload';
import TagInput from './TagInput';
import VideoTrimEditor from './VideoTrimEditor';
import EventSelect from './EventSelect';
import ImageCropDialog from './ImageCropDialog';

interface FileEntry {
  file: File;
  preview: string;
  caption: string;
  tags: MediaTag[];
  isVideo: boolean;
  processedBlob: Blob | null; // For videos: the boomerang result
}

interface MediaUploadDialogProps {
  onClose: () => void;
  onComplete: () => void;
  prefilledEventId?: number | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MediaUploadDialog({ onClose, onComplete, prefilledEventId }: MediaUploadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useBodyScrollLock();

  // Step 1: batch metadata
  const [date, setDate] = useState(todayISO);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    prefilledEventId ? String(prefilledEventId) : '',
  );
  const [files, setFiles] = useState<FileEntry[]>([]);

  // Step 2: per-file metadata
  const [step, setStep] = useState<1 | 2>(1);
  const [croppingIndex, setCroppingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Events for dropdown
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [eventLabels, setEventLabels] = useState<Map<number, string>>(new Map());

  // All tags for autocomplete
  const [allTags, setAllTags] = useState<MediaTag[]>([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener('cancel', handleCancel);
    return () => dialog?.removeEventListener('cancel', handleCancel);
  }, [onClose]);

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
        // Set date from prefilled event
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

    const entries: FileEntry[] = Array.from(selected).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: '',
      tags: [],
      isVideo: file.type.startsWith('video/'),
      processedBlob: null,
    }));
    setFiles((prev) => [...prev, ...entries]);
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }

  function updateCaption(index: number, caption: string) {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], caption };
      return next;
    });
  }

  function handleCropResult(index: number, blob: Blob) {
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

  function updateTags(index: number, tags: MediaTag[]) {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], tags };
      return next;
    });
  }

  function setProcessedBlob(index: number, blob: Blob) {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], processedBlob: blob };
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

  async function handleUpload() {
    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const eventId = selectedEventId ? Number(selectedEventId) : null;

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      setUploadProgress(i);

      try {
        const id = crypto.randomUUID();
        let fullBlob: Blob;
        let thumbBlob: Blob;
        let fullContentType: string;
        let aspectRatio: number;
        const thumbContentType = 'image/jpeg';

        if (entry.isVideo) {
          // Use the processed boomerang blob, extract thumbnail
          fullBlob = entry.processedBlob ?? entry.file;
          fullContentType = 'video/webm';
          thumbBlob = await extractFirstFrame(entry.file);
          aspectRatio = await getVideoAspectRatio(entry.file);
        } else {
          const compressed = await compressImage(entry.file);
          fullBlob = compressed.full;
          thumbBlob = compressed.thumbnail;
          aspectRatio = compressed.aspectRatio;
          fullContentType = 'image/jpeg';
        }

        const fullKey = entry.isVideo ? `video/${id}.webm` : `full/${id}.jpg`;
        const thumbKey = entry.isVideo ? `thumb/${id}.jpg` : `thumb/${id}.jpg`;

        // Get presigned URLs from Edge Function
        const urls = await getUploadUrls([
          { key: fullKey, contentType: fullContentType },
          { key: thumbKey, contentType: thumbContentType },
        ]);

        // Upload to R2
        await Promise.all([
          uploadToR2(urls[0].uploadUrl, fullBlob, fullContentType),
          uploadToR2(urls[1].uploadUrl, thumbBlob, thumbContentType),
        ]);

        const storagePath = urls[0].publicUrl;
        const thumbnailPath = urls[1].publicUrl;

        // Insert media row
        const { data: mediaRow, error: insertError } = await supabase
          .from('media')
          .insert({
            event_id: eventId,
            storage_path: storagePath,
            thumbnail_path: thumbnailPath,
            caption: entry.caption || null,
            taken_at: date,
            media_type: entry.isVideo ? 'video' : 'image',
            aspect_ratio: aspectRatio,
          })
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);

        // Insert tag assignments
        if (entry.tags.length > 0 && mediaRow) {
          const assignments = entry.tags.map((tag) => ({
            media_id: mediaRow.id,
            tag_id: tag.id,
          }));
          const { error: tagError } = await supabase
            .from('media_tag_assignments')
            .insert(assignments);
          if (tagError) throw new Error(tagError.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Error subiendo archivo ${i + 1}: ${message}`);
        setUploading(false);
        return;
      }
    }

    setUploadProgress(files.length);
    onComplete();
  }

  return (
    <>
    <dialog
      ref={dialogRef}
      className="fixed m-auto w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-xl backdrop:bg-on-surface/50"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Subir fotos</h3>
        <button onClick={onClose} className="text-muted hover:text-muted-strong text-xl leading-none transition-colors">&times;</button>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* File picker */}
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

          {/* Event dropdown */}
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

          {/* Date — only shown when no event is selected */}
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

          {/* Next button */}
          <button
            onClick={() => setStep(2)}
            disabled={files.length === 0}
            className="w-full py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {/* Per-file cards */}
          <div className="space-y-4 max-h-80 overflow-y-auto">
            {files.map((entry, i) => (
              <div key={i} className="p-3 border border-border rounded-lg space-y-3">
                <div className="flex gap-3">
                  <div
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-border-subtle ${!entry.isVideo ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''}`}
                    onClick={() => { if (!entry.isVideo) setCroppingIndex(i); }}
                  >
                    {entry.isVideo ? (
                      <video src={entry.preview} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-muted truncate">{entry.file.name}</p>
                      <button
                        onClick={() => removeFile(i)}
                        className="text-muted hover:text-error text-sm leading-none shrink-0 transition-colors"
                      >
                        &times;
                      </button>
                    </div>
                    <input
                      type="text"
                      value={entry.caption}
                      onChange={(e) => updateCaption(i, e.target.value)}
                      placeholder="Descripción (opcional)"
                      className="w-full px-2 py-1 border border-border rounded text-sm bg-surface text-on-surface placeholder:text-muted"
                    />
                    <TagInput
                      allTags={allTags}
                      selectedTags={entry.tags}
                      onChange={(tags) => updateTags(i, tags)}
                      onCreateTag={handleCreateTag}
                    />
                  </div>
                </div>

                {/* Video trim editor */}
                {entry.isVideo && !entry.processedBlob && (
                  <VideoTrimEditor
                    file={entry.file}
                    onConfirm={(blob) => setProcessedBlob(i, blob)}
                  />
                )}
                {entry.isVideo && entry.processedBlob && (
                  <p className="text-xs text-primary">Boomerang listo</p>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-border-subtle rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${(uploadProgress / files.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted text-center">{uploadProgress} / {files.length}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              disabled={uploading}
              className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover disabled:opacity-50 transition-colors"
            >
              Atrás
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0 || files.some((f) => f.isVideo && !f.processedBlob)}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary-hover disabled:bg-disabled disabled:text-muted transition-colors"
            >
              {uploading ? 'Subiendo...' : 'Subir'}
            </button>
          </div>
        </div>
      )}
    </dialog>

    {croppingIndex !== null && files[croppingIndex] && !files[croppingIndex].isVideo && (
      <ImageCropDialog
        src={files[croppingIndex].preview}
        onClose={() => setCroppingIndex(null)}
        onCrop={(blob) => handleCropResult(croppingIndex, blob)}
        onSkip={() => setCroppingIndex(null)}
      />
    )}
  </>
  );
}
