import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';
import { TrophyIcon } from './icons';

interface TrophyCoverProps {
  cover: MediaItem | null;
  title: string;
  /**
   * Adds the foil treatment -- the grade, the glimmer crossing it and the
   * metallic ring. Only for the two covers that are the size of the page: the
   * lead card and the detail hero. On the smaller cards of the list it would be
   * several of these animating at once in a scrolling column, which is the
   * difference between a trophy and a slot machine.
   *
   * The container MUST be `isolate`: the glimmer blends with `screen`, and an
   * un-isolated card blends it against the page behind the card too.
   */
  featured?: boolean;
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
export default function TrophyCover({ cover, title, featured = false }: TrophyCoverProps) {
  return (
    <>
      {cover ? (
        <img
          src={mediaUrl(cover.storage_path)}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-primary pinstripes flex items-center justify-center">
          <TrophyIcon className="w-10 h-10 text-lime/40" />
        </div>
      )}

      {featured && (
        <>
          <div className="absolute inset-0 cover-grade" />
          <div className="absolute inset-0 cover-grain" />
          {/* Exactly the size of the cover: the band's travel is a percentage of
              this element, so anything larger makes it cross in a fraction of
              the time and spend the rest of the pass off-frame. */}
          <div className="absolute inset-0 foil-sweep" />
          {/* Above the scrim the pages draw over the cover, so the ring reads as
              the card's edge rather than as a line under a gradient. */}
          <div className="absolute inset-0 z-10 rounded-xl foil-ring" />
        </>
      )}
    </>
  );
}
