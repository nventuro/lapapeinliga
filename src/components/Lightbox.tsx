import { useEffect, useRef, useCallback, useState } from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { MediaItemWithTags } from '../types';
import { formatDateShort } from '../utils/dateUtils';
import { ShareIcon } from './icons';
import Tooltip from './Tooltip';

const SWIPE_THRESHOLD = 50;

interface LightboxProps {
  item: MediaItemWithTags;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onDelete?: () => void;
  eventLabel?: string | null;
  onEventClick?: () => void;
}

export default function Lightbox({ item, onClose, onPrev, onNext, onDelete, eventLabel, onEventClick }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useBodyScrollLock();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

    return () => {
      dialog?.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && onPrev) onPrev();
    if (e.key === 'ArrowRight' && onNext) onNext();
  }, [onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Swipe handling
  function handleTouchStart(e: React.TouchEvent) {
    setTouchStartX(e.touches[0].clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta > SWIPE_THRESHOLD && onPrev) onPrev();
    if (delta < -SWIPE_THRESHOLD && onNext) onNext();
    setTouchStartX(null);
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        // Try sharing the actual file
        const response = await fetch(item.storage_path);
        const blob = await response.blob();
        const ext = item.media_type === 'video' ? 'webm' : 'jpg';
        const file = new File([blob], `foto.${ext}`, { type: blob.type });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          await navigator.share({ url: item.storage_path });
        }
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(item.storage_path);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 w-full h-full max-w-none max-h-none m-0 p-0 bg-on-surface/90 backdrop:bg-transparent"
    >
      <div
        className="flex flex-col h-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 shrink-0">
          <button
            onClick={onClose}
            className="text-on-primary/80 hover:text-on-primary text-2xl leading-none px-2 transition-colors"
          >
            &times;
          </button>
          <div className="flex items-center gap-2">
            <Tooltip label="Compartir">
              <button
                onClick={handleShare}
                className="text-on-primary/80 hover:text-on-primary p-1.5 transition-colors"
              >
                <ShareIcon className="w-5 h-5" />
              </button>
            </Tooltip>
            {onDelete && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-error/80 hover:text-error text-sm font-medium px-3 py-1.5 transition-colors"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>

        {/* Media content — click outside the image/video closes */}
        <div
          className="flex-1 flex items-center justify-center relative min-h-0 px-2"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          {/* Prev button */}
          {onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-on-primary/60 hover:text-on-primary text-4xl leading-none z-10 p-2 transition-colors"
            >
              &#8249;
            </button>
          )}

          {/* Image or video */}
          <div className="max-w-full max-h-full flex items-center justify-center">
            {item.media_type === 'video' ? (
              <video
                key={item.id}
                src={item.storage_path}
                autoPlay
                loop
                muted
                playsInline
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
              />
            ) : (
              <img
                key={item.id}
                src={item.storage_path}
                alt={item.caption ?? ''}
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
              />
            )}
          </div>

          {/* Next button */}
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-primary/60 hover:text-on-primary text-4xl leading-none z-10 p-2 transition-colors"
            >
              &#8250;
            </button>
          )}
        </div>

        {/* Info footer */}
        <div className="p-4 shrink-0 text-on-primary/90 space-y-2 max-w-2xl mx-auto w-full text-center">
          {item.caption && (
            <p className="text-lg">{item.caption}</p>
          )}
          <div className="flex items-center justify-center gap-3 text-sm text-on-primary/60">
            <span>{formatDateShort(item.taken_at)}</span>
            {eventLabel && onEventClick && (
              <button
                onClick={onEventClick}
                className="text-primary hover:text-primary-hover transition-colors"
              >
                {eventLabel}
              </button>
            )}
          </div>
          {item.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-center pt-1">
              {item.tags.map((tag) => (
                <span key={tag.id} className="text-sm px-3 py-1 bg-on-primary/10 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {confirmingDelete && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl border border-error p-6 mx-4 max-w-sm w-full shadow-xl">
            <p className="text-sm text-on-surface mb-4">¿Eliminar esta foto? Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium border border-border text-muted hover:text-muted-strong hover:border-neutral-hover transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setConfirmingDelete(false); onDelete?.(); }}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-error text-on-primary hover:bg-error/80 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
