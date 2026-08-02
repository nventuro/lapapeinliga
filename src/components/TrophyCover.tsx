import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';
import { TrophyIcon } from './icons';

interface TrophyCoverProps {
  cover: MediaItem | null;
  title: string;
  /** Thumbnails are enough for the list; the detail page wants the full image. */
  full?: boolean;
}

/**
 * The cover image behind a trophy card, with the stand-in used when there is
 * no cover yet.
 *
 * A cover-led layout falls apart the moment a cover is missing, so the empty
 * case is a designed surface rather than a blank box: the navy band the club
 * already uses, carrying its pinstripes and the crest's trophy mark.
 */
export default function TrophyCover({ cover, title, full = false }: TrophyCoverProps) {
  if (!cover) {
    return (
      <div className="absolute inset-0 bg-primary pinstripes flex items-center justify-center">
        <TrophyIcon className="w-10 h-10 text-lime/40" />
      </div>
    );
  }

  return (
    <img
      src={mediaUrl(full ? cover.storage_path : cover.thumbnail_path)}
      alt={title}
      className="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
    />
  );
}
