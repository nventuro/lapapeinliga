import type { MediaItem } from '../types';
import { mediaUrl } from '../utils/mediaUpload';
import { TrophyIcon } from './icons';

interface TrophyCoverProps {
  cover: MediaItem | null;
  title: string;
  /**
   * The point of the image (percent of each axis) this crop keeps in view --
   * the trophy's `cover_focus_x`/`cover_focus_y`. One stored point serves every
   * frame because that is `object-position`'s own semantic: the x%/y% point of
   * the image is pinned to the x%/y% point of the box, whatever the box's
   * aspect ratio.
   */
  focusX: number;
  focusY: number;
  /**
   * How far along its cycle this cover's foil already is, applied as a
   * negative animation-delay. Every cover gets the foil treatment, and a
   * column of covers all glimmering on the same beat reads as a slot machine
   * rather than a trophy case -- the stagger is what keeps each pass reading
   * as one light crossing one surface.
   */
  foilDelaySeconds?: number;
}

/**
 * The cover image behind a trophy card, with the stand-in used when there is
 * no cover yet. Always foiled -- the grade, the glimmer crossing it and the
 * metallic ring. The container MUST be `isolate`: the glimmer blends with
 * `screen`, and an un-isolated card blends it against the page behind the
 * card too.
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
export default function TrophyCover({
  cover, title, focusX, focusY, foilDelaySeconds = 0,
}: TrophyCoverProps) {
  // Negative: the animation is already mid-cycle on mount, so the covers are
  // spread across the beat from the first frame instead of queueing behind it.
  const foilDelay = { animationDelay: `-${foilDelaySeconds}s` };
  return (
    <>
      {cover ? (
        <img
          src={mediaUrl(cover.storage_path)}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `${focusX}% ${focusY}%` }}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-primary pinstripes flex items-center justify-center">
          <TrophyIcon className="w-10 h-10 text-lime/40" />
        </div>
      )}

      <div className="absolute inset-0 cover-grade" />
      <div className="absolute inset-0 cover-grain" />
      {/* Exactly the size of the cover: the band's travel is a percentage of
          this element, so anything larger makes it cross in a fraction of
          the time and spend the rest of the pass off-frame. */}
      <div className="absolute inset-0 foil-sweep" style={foilDelay} />
      {/* Above the scrim the pages draw over the cover, so the ring reads as
          the card's edge rather than as a line under a gradient. */}
      <div className="absolute inset-0 z-10 rounded-xl foil-ring" style={foilDelay} />
    </>
  );
}
