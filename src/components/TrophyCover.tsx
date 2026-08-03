import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';
import { TrophyIcon } from './icons';

interface TrophyCoverProps {
  cover: MediaItem | null;
  title: string;
}

/**
 * The cover image behind a trophy card, with the stand-in used when there is
 * no cover yet.
 *
 * A cover-led layout falls apart the moment a cover is missing, so the empty
 * case is a designed surface rather than a blank box: the navy band the club
 * already uses, carrying its pinstripes and the crest's trophy mark.
 *
 * Always the full image, never the thumbnail: even the smaller cards are the
 * width of the page, which is 358 CSS px on a phone and 672 on desktop -- times
 * the device pixel ratio. A THUMBNAIL_MAX_WIDTH (400px) source is upscaled
 * severalfold there and reads as visibly pixelated. `loading="lazy"` is what
 * keeps the weight off the page instead: covers below the fold cost nothing
 * until they are scrolled to.
 */
export default function TrophyCover({ cover, title }: TrophyCoverProps) {
  if (!cover) {
    return (
      <div className="absolute inset-0 bg-primary pinstripes flex items-center justify-center">
        <TrophyIcon className="w-10 h-10 text-lime/40" />
      </div>
    );
  }

  return (
    <img
      src={mediaUrl(cover.storage_path)}
      alt={title}
      className="absolute inset-0 w-full h-full object-cover"
      loading="lazy"
    />
  );
}
