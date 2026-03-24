import { useEffect, useRef, useCallback } from 'react';
import type { MediaItemWithTags } from '../types';
import { formatDateShort } from '../utils/dateUtils';
import { ShareIcon } from './icons';
import Tooltip from './Tooltip';

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && onPrev) onPrev();
    if (e.key === 'ArrowRight' && onNext) onNext();
  }, [onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  async function handleShare() {
    const url = item.storage_path;
    if (navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        // User cancelled share — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 w-full h-full max-w-none max-h-none m-0 p-0 bg-on-surface/90 backdrop:bg-transparent"
    >
      <div className="flex flex-col h-full">
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
                onClick={onDelete}
                className="text-error/80 hover:text-error text-sm font-medium px-2 py-1 transition-colors"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>

        {/* Media content */}
        <div className="flex-1 flex items-center justify-center relative min-h-0 px-2">
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
        <div className="p-4 shrink-0 text-on-primary/90 space-y-1 max-w-2xl mx-auto w-full">
          {item.caption && (
            <p className="text-sm">{item.caption}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-on-primary/60">
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
            <div className="flex gap-1.5 flex-wrap pt-1">
              {item.tags.map((tag) => (
                <span key={tag.id} className="text-xs px-2 py-0.5 bg-on-primary/10 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
