import { useEffect, useCallback, useState } from 'react';
import { useModalDialog } from '../hooks/useModalDialog';
import type { MediaItemWithTags, Player, TaggedPlayer } from '../types';
import { formatDateShort } from '../utils/dateUtils';
import { mediaUrl } from '../utils/mediaUpload';
import { ShareIcon, UserGroupIcon } from './icons';
import Tooltip from './Tooltip';
import PlayerTagInput from './PlayerTagInput';

const SWIPE_THRESHOLD = 50;

interface LightboxProps {
  item: MediaItemWithTags;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onDelete?: () => void;
  eventLabel?: string | null;
  onEventClick?: () => void;
  onPlayerClick?: (playerId: number) => void;
  // Player tagging (mods + admins)
  canEditTags?: boolean;
  tagCandidates?: Player[];
  allPlayers?: Player[];
  tagCandidatesLoading?: boolean;
  onTogglePlayerTag?: (player: TaggedPlayer, tagged: boolean) => void;
}

export default function Lightbox({
  item, onClose, onPrev, onNext, onDelete, eventLabel, onEventClick,
  onPlayerClick, canEditTags, tagCandidates, allPlayers, tagCandidatesLoading, onTogglePlayerTag,
}: LightboxProps) {
  // Full-screen dialog: no backdrop area, so backdropClick is unused.
  const { dialogRef } = useModalDialog(onClose);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't hijack arrow keys while the user is typing (e.g. in the player-tag
    // search input): navigating would remount the lightbox and eat their text.
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
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
        const response = await fetch(mediaUrl(item.storage_path));
        const blob = await response.blob();
        const file = new File([blob], 'foto.jpg', { type: blob.type });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          await navigator.share({ url: mediaUrl(item.storage_path) });
        }
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(mediaUrl(item.storage_path));
    }
  }

  function handleTagToggle(players: TaggedPlayer[]) {
    if (!onTogglePlayerTag) return;

    // Determine which player was added or removed
    const currentIds = new Set(item.taggedPlayers.map((p) => p.id));
    const newIds = new Set(players.map((p) => p.id));

    for (const player of players) {
      if (!currentIds.has(player.id)) {
        onTogglePlayerTag(player, true);
        return;
      }
    }

    for (const player of item.taggedPlayers) {
      if (!newIds.has(player.id)) {
        onTogglePlayerTag(player, false);
        return;
      }
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
            {canEditTags && onTogglePlayerTag && (
              <Tooltip label="Etiquetar personas">
                <button
                  onClick={() => setShowTagEditor((v) => !v)}
                  className={`p-1.5 transition-colors ${
                    showTagEditor
                      ? 'text-accent'
                      : 'text-on-primary/80 hover:text-on-primary'
                  }`}
                >
                  <UserGroupIcon className="w-5 h-5" />
                </button>
              </Tooltip>
            )}
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
                className="text-sm font-medium px-3 py-1 rounded-full border border-error bg-surface text-error hover:bg-error hover:text-on-primary transition-colors"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>

        {/* Media content — click outside the image closes */}
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

          {/* Image */}
          <div className="max-w-full max-h-full flex items-center justify-center">
            <img
              key={item.id}
              src={mediaUrl(item.storage_path)}
              alt={item.caption ?? ''}
              className="max-w-full max-h-[70vh] rounded-lg object-contain"
            />
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
                className="text-accent hover:text-accent-hover transition-colors"
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
          {/* Tagged players */}
          {item.taggedPlayers.length > 0 && (
            <div className="flex gap-2 flex-wrap justify-center pt-1">
              {item.taggedPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => onPlayerClick?.(player.id)}
                  className="text-sm px-3 py-1 bg-on-primary/20 rounded-full hover:bg-on-primary/30 transition-colors"
                >
                  {player.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Admin tag editor panel */}
        {showTagEditor && tagCandidates && (
          <div className="shrink-0 border-t border-on-primary/20 p-4 max-w-2xl mx-auto w-full">
            <PlayerTagInput
              candidates={tagCandidates}
              allPlayers={allPlayers ?? []}
              selected={item.taggedPlayers}
              onChange={handleTagToggle}
              loading={tagCandidatesLoading}
            />
          </div>
        )}
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
